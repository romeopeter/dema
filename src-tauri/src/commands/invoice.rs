use rusqlite::{params, Connection, OptionalExtension, Transaction};
use tauri::State;

use crate::commands::{clean, one_of, require_text, settings};
use crate::error::{AppError, AppResult};
use crate::models::invoice::{
    line_amount_cents, vat_cents, Invoice, InvoiceDetail, InvoiceInput, InvoiceSummary, LineItem,
};
use crate::state::AppState;

fn fetch(conn: &Connection, id: i64) -> AppResult<Invoice> {
    let sql = format!("{} WHERE i.id = ?1", Invoice::SELECT);
    conn.query_row(&sql, params![id], |row| Ok(Invoice::from_row(row)))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That invoice no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
}

fn fetch_items(conn: &Connection, invoice_id: i64) -> AppResult<Vec<LineItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, invoice_id, description, quantity, unit_price_cents, position
         FROM invoice_line_items WHERE invoice_id = ?1 ORDER BY position, id",
    )?;
    let rows = stmt.query_map(params![invoice_id], |row| Ok(LineItem::from_row(row)))?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

#[tauri::command]
pub fn list_invoices(state: State<'_, AppState>, profile_id: i64) -> AppResult<Vec<Invoice>> {
    let conn = state.conn()?;
    let sql = format!(
        "{} WHERE i.profile_id = ?1 ORDER BY i.issue_date DESC, i.id DESC",
        Invoice::SELECT
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![profile_id], |row| Ok(Invoice::from_row(row)))?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

#[tauri::command]
pub fn get_invoice(state: State<'_, AppState>, id: i64) -> AppResult<InvoiceDetail> {
    let conn = state.conn()?;
    detail(&conn, id)
}

pub fn detail(conn: &Connection, id: i64) -> AppResult<InvoiceDetail> {
    Ok(InvoiceDetail {
        invoice: fetch(conn, id)?,
        items: fetch_items(conn, id)?,
    })
}

/// Next free number for the profile, e.g. `DW-018`. Reads the highest numeric suffix
/// already used rather than counting rows, so deleting a draft never reissues a number.
#[tauri::command]
pub fn next_invoice_number(state: State<'_, AppState>, profile_id: i64) -> AppResult<String> {
    let conn = state.conn()?;
    next_number(&conn, profile_id)
}

fn next_number(conn: &Connection, profile_id: i64) -> AppResult<String> {
    let prefix = settings::read(conn, "invoice_prefix")?.unwrap_or_else(|| "DW".into());
    let mut stmt =
        conn.prepare("SELECT invoice_number FROM invoices WHERE profile_id = ?1")?;
    let highest = stmt
        .query_map(params![profile_id], |r| r.get::<_, String>(0))?
        .filter_map(Result::ok)
        .filter_map(|number| {
            number
                .rsplit('-')
                .next()
                .and_then(|tail| tail.parse::<i64>().ok())
        })
        .max()
        .unwrap_or(0);
    Ok(format!("{prefix}-{:03}", highest + 1))
}

/// Totals an invoice from its lines. Rounding happens once per line and once for VAT,
/// so the stored subtotal, VAT and total always add up exactly.
fn totals(items: &[crate::models::invoice::LineItemInput], vat_rate_bp: i64) -> (i64, i64, i64) {
    let subtotal: i64 = items
        .iter()
        .map(|it| line_amount_cents(it.quantity, it.unit_price_cents))
        .sum();
    let vat = vat_cents(subtotal, vat_rate_bp);
    (subtotal, vat, subtotal + vat)
}

fn write_items(
    tx: &Transaction<'_>,
    invoice_id: i64,
    items: &[crate::models::invoice::LineItemInput],
) -> AppResult<()> {
    tx.execute(
        "DELETE FROM invoice_line_items WHERE invoice_id = ?1",
        params![invoice_id],
    )?;
    for (position, item) in items.iter().enumerate() {
        let description = require_text("Line description", &item.description)?;
        if item.quantity <= 0.0 {
            return Err(AppError::Validation(
                "Every line needs a quantity greater than zero.".into(),
            ));
        }
        if item.unit_price_cents < 0 {
            return Err(AppError::Validation(
                "A unit price cannot be negative.".into(),
            ));
        }
        tx.execute(
            "INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price_cents, position)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![invoice_id, description, item.quantity, item.unit_price_cents, position as i64],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_invoice(state: State<'_, AppState>, input: InvoiceInput) -> AppResult<InvoiceDetail> {
    let id = {
        let mut conn = state.conn()?;
        insert_invoice(&mut conn, &input)?
    };
    get_invoice(state, id)
}

pub fn insert_invoice(conn: &mut Connection, input: &InvoiceInput) -> AppResult<i64> {
    let status = one_of("Status", &input.status, &["draft", "sent"])?;
    let issue_date = require_text("Issue date", &input.issue_date)?;
    let due_date = require_text("Due date", &input.due_date)?;
    if input.items.is_empty() {
        return Err(AppError::Validation("Add at least one line item.".into()));
    }

    let id = {
        let default_vat = settings::read_i64(conn, "vat_rate_bp", 750)?;
        let vat_rate_bp = input.vat_rate_bp.unwrap_or(default_vat);
        let (subtotal, vat, total) = totals(&input.items, vat_rate_bp);
        let number = next_number(conn, input.profile_id)?;

        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO invoices
               (profile_id, client_id, invoice_number, issue_date, due_date, status,
                subtotal_cents, vat_rate_bp, vat_cents, total_amount_cents, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                input.profile_id,
                input.client_id,
                number,
                issue_date,
                due_date,
                status,
                subtotal,
                vat_rate_bp,
                vat,
                total,
                clean(input.notes.clone())
            ],
        )?;
        let id = tx.last_insert_rowid();
        write_items(&tx, id, &input.items)?;
        tx.commit()?;
        id
    };

    Ok(id)
}

#[tauri::command]
pub fn update_invoice(
    state: State<'_, AppState>,
    id: i64,
    input: InvoiceInput,
) -> AppResult<InvoiceDetail> {
    let status = one_of("Status", &input.status, &["draft", "sent"])?;
    let issue_date = require_text("Issue date", &input.issue_date)?;
    let due_date = require_text("Due date", &input.due_date)?;
    if input.items.is_empty() {
        return Err(AppError::Validation("Add at least one line item.".into()));
    }

    {
        let mut conn = state.conn()?;
        let current = fetch(&conn, id)?;
        if current.status == "paid" {
            return Err(AppError::Conflict(
                "A paid invoice cannot be edited. Reopen it first.".into(),
            ));
        }
        let default_vat = settings::read_i64(&conn, "vat_rate_bp", 750)?;
        let vat_rate_bp = input.vat_rate_bp.unwrap_or(default_vat);
        let (subtotal, vat, total) = totals(&input.items, vat_rate_bp);

        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE invoices
             SET client_id = ?2, issue_date = ?3, due_date = ?4, status = ?5,
                 subtotal_cents = ?6, vat_rate_bp = ?7, vat_cents = ?8,
                 total_amount_cents = ?9, notes = ?10
             WHERE id = ?1",
            params![
                id,
                input.client_id,
                issue_date,
                due_date,
                status,
                subtotal,
                vat_rate_bp,
                vat,
                total,
                clean(input.notes.clone())
            ],
        )?;
        write_items(&tx, id, &input.items)?;
        tx.commit()?;
    }

    get_invoice(state, id)
}

/// Marking paid is one atomic SQLite transaction: the invoice flips to paid *and* the
/// linked income transaction appears, or neither happens. A crash between the two writes
/// cannot leave a paid invoice with no income, or income with no invoice.
#[tauri::command]
pub fn mark_invoice_paid(
    state: State<'_, AppState>,
    id: i64,
    payment_type: Option<String>,
    paid_on: Option<String>,
) -> AppResult<InvoiceDetail> {
    {
        let mut conn = state.conn()?;
        mark_paid(&mut conn, id, payment_type, paid_on)?;
    }
    get_invoice(state, id)
}

pub fn mark_paid(
    conn: &mut Connection,
    id: i64,
    payment_type: Option<String>,
    paid_on: Option<String>,
) -> AppResult<()> {
    let payment_type = one_of(
        "Payment type",
        &payment_type.unwrap_or_else(|| "check".into()),
        &["cash", "card", "check"],
    )?;

    {
        let invoice = fetch(conn, id)?;
        if invoice.status == "paid" {
            return Err(AppError::Conflict(format!(
                "Invoice {} is already marked paid.",
                invoice.invoice_number
            )));
        }
        if invoice.status == "draft" {
            return Err(AppError::Validation(
                "Send the invoice before marking it paid.".into(),
            ));
        }

        // Defence in depth: a unique index also guarantees one transaction per invoice.
        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM transactions WHERE invoice_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .optional()?;
        if existing.is_some() {
            return Err(AppError::Conflict(
                "That invoice already has a linked income transaction.".into(),
            ));
        }

        let category_id = income_category(conn, invoice.profile_id)?;
        let date = paid_on.unwrap_or_default();

        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        tx.execute(
            "INSERT INTO transactions
               (profile_id, amount_cents, category_id, payment_type, status, kind, date, note, invoice_id)
             VALUES (?1, ?2, ?3, ?4, 'posted', 'income',
                     COALESCE(NULLIF(?5, ''), date('now', 'localtime')), ?6, ?7)",
            params![
                invoice.profile_id,
                invoice.total_amount_cents,
                category_id,
                payment_type,
                date,
                format!("Invoice {} — {}", invoice.invoice_number, invoice.client_name),
                id
            ],
        )?;
        tx.commit()?;
    }

    Ok(())
}

/// Undoes `mark_invoice_paid`, just as atomically: the invoice goes back to sent and its
/// linked income disappears together. Without this a mis-click would be unfixable, since
/// the linked transaction refuses to be deleted on its own.
#[tauri::command]
pub fn reopen_invoice(state: State<'_, AppState>, id: i64) -> AppResult<InvoiceDetail> {
    {
        let mut conn = state.conn()?;
        let invoice = fetch(&conn, id)?;
        if invoice.status != "paid" {
            return Err(AppError::Validation("That invoice is not marked paid.".into()));
        }
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM transactions WHERE invoice_id = ?1", params![id])?;
        tx.execute(
            "UPDATE invoices SET status = 'sent', paid_at = NULL WHERE id = ?1",
            params![id],
        )?;
        tx.commit()?;
    }
    get_invoice(state, id)
}

#[tauri::command]
pub fn send_invoice(state: State<'_, AppState>, id: i64) -> AppResult<InvoiceDetail> {
    {
        let conn = state.conn()?;
        let invoice = fetch(&conn, id)?;
        if invoice.status != "draft" {
            return Err(AppError::Validation("That invoice has already been sent.".into()));
        }
        conn.execute(
            "UPDATE invoices SET status = 'sent' WHERE id = ?1",
            params![id],
        )?;
    }
    get_invoice(state, id)
}

#[tauri::command]
pub fn delete_invoice(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state.conn()?;
    let invoice = fetch(&conn, id)?;
    if invoice.status == "paid" {
        return Err(AppError::Conflict(
            "A paid invoice cannot be deleted — its income is on the books. Reopen it first."
                .into(),
        ));
    }
    conn.execute("DELETE FROM invoices WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn invoice_summary(state: State<'_, AppState>, profile_id: i64) -> AppResult<InvoiceSummary> {
    let conn = state.conn()?;
    conn.query_row(
        "SELECT
           COALESCE(SUM(CASE WHEN status = 'sent' THEN total_amount_cents END), 0),
           COUNT(CASE WHEN status = 'draft' THEN 1 END),
           COUNT(CASE WHEN status = 'sent' AND due_date >= date('now', 'localtime') THEN 1 END),
           COUNT(CASE WHEN status = 'sent' AND due_date <  date('now', 'localtime') THEN 1 END),
           COUNT(CASE WHEN status = 'paid' THEN 1 END)
         FROM invoices WHERE profile_id = ?1",
        params![profile_id],
        |r| {
            Ok(InvoiceSummary {
                outstanding_cents: r.get(0)?,
                draft_count: r.get(1)?,
                sent_count: r.get(2)?,
                overdue_count: r.get(3)?,
                paid_count: r.get(4)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Where invoice income lands. Prefers the built-in "Client payment" category so the
/// tax report groups every invoice under one line.
fn income_category(conn: &Connection, profile_id: i64) -> AppResult<i64> {
    let scope = crate::commands::category::profile_type(conn, profile_id)?;
    conn.query_row(
        "SELECT id FROM categories
         WHERE kind = 'income' AND is_deleted = 0
           AND (profile_id = ?1 OR (profile_id IS NULL AND profile_type = ?2))
         ORDER BY CASE WHEN name = 'Client payment' THEN 0 ELSE 1 END, is_builtin DESC, sort_order
         LIMIT 1",
        params![profile_id, scope],
        |r| r.get(0),
    )
    .optional()?
    .ok_or_else(|| {
        AppError::Validation(
            "This profile has no income category to post the payment to. Add one first.".into(),
        )
    })
}
