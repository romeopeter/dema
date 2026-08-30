use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::{clean, one_of, require_text};
use crate::error::{AppError, AppResult};
use crate::models::transaction::{
    CategoryTotal, DashboardSummary, NewTransaction, TransactionRow,
};
use crate::state::AppState;

/// Inclusive date bounds for a dashboard period. `all` has no bounds.
/// The arithmetic is left to SQLite so "this week" respects the user's clock and the
/// week-start preference without a date library in the mix.
pub fn period_bounds(
    conn: &Connection,
    period: &str,
    week_start_monday: bool,
) -> AppResult<(Option<String>, Option<String>)> {
    let period = one_of(
        "Period",
        &period.to_lowercase(),
        &["all", "daily", "weekly", "monthly", "yearly"],
    )?;

    // `weekday N` jumps forward to the next N (staying put if today is already N), so
    // shifting a day forward first and a week back after lands on the current week's start
    // even when today *is* the start day.
    let (start_expr, span) = match period.as_str() {
        "all" => return Ok((None, None)),
        "daily" => ("date('now', 'localtime')", "+1 day"),
        "weekly" => {
            if week_start_monday {
                ("date('now', 'localtime', '+1 day', 'weekday 1', '-7 days')", "+7 days")
            } else {
                ("date('now', 'localtime', '+1 day', 'weekday 0', '-7 days')", "+7 days")
            }
        }
        "monthly" => ("date('now', 'localtime', 'start of month')", "+1 month"),
        _ => ("date('now', 'localtime', 'start of year')", "+1 year"),
    };

    let sql = format!("SELECT {start_expr}, date({start_expr}, '{span}', '-1 day')");
    let (from, to): (String, String) = conn.query_row(&sql, [], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok((Some(from), Some(to)))
}

#[tauri::command]
pub fn list_transactions(
    state: State<'_, AppState>,
    profile_id: i64,
    filter: Option<String>,
    limit: Option<i64>,
) -> AppResult<Vec<TransactionRow>> {
    let filter = one_of(
        "Filter",
        &filter.unwrap_or_else(|| "all".into()).to_lowercase(),
        &["all", "posted", "drafts"],
    )?;
    let status_clause = match filter.as_str() {
        "posted" => " AND t.status = 'posted'",
        "drafts" => " AND t.status = 'draft'",
        _ => "",
    };

    let conn = state.conn()?;
    let sql = format!(
        "{} WHERE t.profile_id = ?1{status_clause}
         ORDER BY t.date DESC, t.id DESC
         LIMIT ?2",
        TransactionRow::SELECT
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![profile_id, limit.unwrap_or(-1)], |row| {
        Ok(TransactionRow::from_row(row))
    })?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

pub fn fetch(conn: &Connection, id: i64) -> AppResult<TransactionRow> {
    let sql = format!("{} WHERE t.id = ?1", TransactionRow::SELECT);
    conn.query_row(&sql, params![id], |row| Ok(TransactionRow::from_row(row)))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That transaction no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
}

/// Rejects a category that belongs to another profile's books, which would otherwise
/// leak Personal spending into the Business ledger.
fn check_category(conn: &Connection, profile_id: i64, category_id: i64) -> AppResult<()> {
    let scope = crate::commands::category::profile_type(conn, profile_id)?;
    let ok: i64 = conn.query_row(
        "SELECT count(*) FROM categories
         WHERE id = ?1 AND (profile_id = ?2 OR (profile_id IS NULL AND profile_type = ?3))",
        params![category_id, profile_id, scope],
        |r| r.get(0),
    )?;
    if ok == 0 {
        return Err(AppError::Validation(
            "That category does not belong to this profile.".into(),
        ));
    }
    Ok(())
}

fn validate(input: &NewTransaction) -> AppResult<(String, String, String, String)> {
    if input.amount_cents <= 0 {
        return Err(AppError::Validation(
            "Amount must be greater than zero.".into(),
        ));
    }
    Ok((
        one_of("Payment type", &input.payment_type, &["cash", "card", "check"])?,
        one_of("Status", &input.status, &["draft", "posted"])?,
        one_of("Type", &input.kind, &["income", "expense"])?,
        require_text("Date", &input.date)?,
    ))
}

#[tauri::command]
pub fn create_transaction(
    state: State<'_, AppState>,
    input: NewTransaction,
) -> AppResult<TransactionRow> {
    let conn = state.conn()?;
    insert_transaction(&conn, &input)
}

pub fn insert_transaction(
    conn: &Connection,
    input: &NewTransaction,
) -> AppResult<TransactionRow> {
    let (payment_type, status, kind, date) = validate(input)?;
    check_category(conn, input.profile_id, input.category_id)?;

    conn.execute(
        "INSERT INTO transactions
           (profile_id, amount_cents, category_id, payment_type, status, kind, date, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.profile_id,
            input.amount_cents,
            input.category_id,
            payment_type,
            status,
            kind,
            date,
            clean(input.note.clone())
        ],
    )?;
    fetch(conn, conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_transaction(
    state: State<'_, AppState>,
    id: i64,
    input: NewTransaction,
) -> AppResult<TransactionRow> {
    let (payment_type, status, kind, date) = validate(&input)?;
    let conn = state.conn()?;
    check_category(&conn, input.profile_id, input.category_id)?;

    // An invoice-linked transaction mirrors its invoice; letting the amount drift here
    // would silently break that pairing.
    let linked: Option<String> = conn
        .query_row(
            "SELECT i.invoice_number FROM transactions t
             JOIN invoices i ON i.id = t.invoice_id WHERE t.id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(number) = linked {
        return Err(AppError::Conflict(format!(
            "This income came from invoice {number}. Edit the invoice instead."
        )));
    }

    let changed = conn.execute(
        "UPDATE transactions
         SET amount_cents = ?2, category_id = ?3, payment_type = ?4, status = ?5,
             kind = ?6, date = ?7, note = ?8
         WHERE id = ?1",
        params![
            id,
            input.amount_cents,
            input.category_id,
            payment_type,
            status,
            kind,
            date,
            clean(input.note.clone())
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("That transaction no longer exists.".into()));
    }
    fetch(&conn, id)
}

/// Promotes a draft into the books. This is the only thing that makes it count.
#[tauri::command]
pub fn post_transaction(state: State<'_, AppState>, id: i64) -> AppResult<TransactionRow> {
    let conn = state.conn()?;
    let changed = conn.execute(
        "UPDATE transactions SET status = 'posted' WHERE id = ?1",
        params![id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("That transaction no longer exists.".into()));
    }
    fetch(&conn, id)
}

#[tauri::command]
pub fn delete_transaction(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state.conn()?;
    let linked: Option<String> = conn
        .query_row(
            "SELECT i.invoice_number FROM transactions t
             JOIN invoices i ON i.id = t.invoice_id WHERE t.id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(number) = linked {
        return Err(AppError::Conflict(format!(
            "This income came from invoice {number}. Reopen that invoice to remove it."
        )));
    }

    let changed = conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound("That transaction no longer exists.".into()));
    }
    Ok(())
}

/// Dashboard figures for one period. Every aggregate here filters `status = 'posted'`:
/// drafts must never reach a total or the donut.
#[tauri::command]
pub fn dashboard_summary(
    state: State<'_, AppState>,
    profile_id: i64,
    period: Option<String>,
) -> AppResult<DashboardSummary> {
    let conn = state.conn()?;
    let period = period.unwrap_or_else(|| "monthly".into());
    summarise(&conn, profile_id, &period)
}

pub fn summarise(
    conn: &Connection,
    profile_id: i64,
    period: &str,
) -> AppResult<DashboardSummary> {
    let week_start_monday = crate::commands::settings::read_bool(conn, "week_start_monday", false)?;
    let (from, to) = period_bounds(conn, period, week_start_monday)?;

    let (income_cents, spent_cents): (i64, i64) = conn.query_row(
        "SELECT
           COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount_cents END), 0),
           COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents END), 0)
         FROM transactions
         WHERE profile_id = ?1 AND status = 'posted'
           AND (?2 IS NULL OR date >= ?2) AND (?3 IS NULL OR date <= ?3)",
        params![profile_id, from, to],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;

    // Drafts are counted for the whole profile, not the period: the sidebar nudge is
    // about unfinished work, which does not expire when the month rolls over.
    let draft_count: i64 = conn.query_row(
        "SELECT count(*) FROM transactions WHERE profile_id = ?1 AND status = 'draft'",
        params![profile_id],
        |r| r.get(0),
    )?;

    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.color, c.icon, c.kind, SUM(t.amount_cents) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE t.profile_id = ?1 AND t.status = 'posted' AND t.kind = 'expense'
           AND (?2 IS NULL OR t.date >= ?2) AND (?3 IS NULL OR t.date <= ?3)
         GROUP BY c.id
         ORDER BY total DESC
         LIMIT 3",
    )?;
    let raw = stmt
        .query_map(params![profile_id, from, to], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let top_categories = raw
        .into_iter()
        .map(|(category_id, name, color, icon, kind, total_cents)| CategoryTotal {
            category_id,
            name,
            color,
            icon,
            kind,
            total_cents,
            percent: if spent_cents > 0 {
                (total_cents * 100) / spent_cents
            } else {
                0
            },
        })
        .collect();

    Ok(DashboardSummary {
        income_cents,
        spent_cents,
        net_cents: income_cents - spent_cents,
        draft_count,
        from_date: from,
        to_date: to,
        top_categories,
    })
}
