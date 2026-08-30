use std::path::PathBuf;

use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::require_text;
use crate::error::{AppError, AppResult};
use crate::models::report::{Report, ReportRow};
use crate::pdf::{self, Align, Font, Pdf};
use crate::state::AppState;

/// Category-by-category tax summary over a date range. Posted only: a draft has not
/// happened yet as far as the books are concerned.
#[tauri::command]
pub fn category_report(
    state: State<'_, AppState>,
    profile_id: i64,
    from_date: String,
    to_date: String,
) -> AppResult<Report> {
    let conn = state.conn()?;
    build_report(&conn, profile_id, &from_date, &to_date)
}

pub fn build_report(
    conn: &Connection,
    profile_id: i64,
    from_date: &str,
    to_date: &str,
) -> AppResult<Report> {
    let from_date = require_text("Start date", from_date)?;
    let to_date = require_text("End date", to_date)?;
    if from_date > to_date {
        return Err(AppError::Validation(
            "The start date must come before the end date.".into(),
        ));
    }

    let (profile_name, profile_type): (String, String) = conn
        .query_row(
            "SELECT name, type FROM profiles WHERE id = ?1",
            params![profile_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That profile no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?;

    // Grouped by category *and* kind: the same category can legitimately hold both a
    // refund and a spend, and collapsing them would net out to a misleading line.
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.color, t.kind, c.tax_deductible,
                COUNT(*) AS n, SUM(t.amount_cents) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE t.profile_id = ?1 AND t.status = 'posted'
           AND t.date >= ?2 AND t.date <= ?3
         GROUP BY c.id, t.kind
         ORDER BY CASE t.kind WHEN 'income' THEN 0 ELSE 1 END, total DESC",
    )?;
    let rows: Vec<ReportRow> = stmt
        .query_map(params![profile_id, from_date, to_date], |row| {
            Ok(ReportRow {
                category_id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                kind: row.get(3)?,
                tax_deductible: row.get::<_, i64>(4)? != 0,
                transaction_count: row.get(5)?,
                total_cents: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let income_cents = rows
        .iter()
        .filter(|r| r.kind == "income")
        .map(|r| r.total_cents)
        .sum();
    let expense_cents: i64 = rows
        .iter()
        .filter(|r| r.kind == "expense")
        .map(|r| r.total_cents)
        .sum();
    let deductible_cents = rows
        .iter()
        .filter(|r| r.kind == "expense" && r.tax_deductible)
        .map(|r| r.total_cents)
        .sum();
    let transaction_count = rows.iter().map(|r| r.transaction_count).sum();

    Ok(Report {
        profile_id,
        profile_name,
        profile_type,
        from_date,
        to_date,
        income_cents,
        expense_cents,
        deductible_cents,
        transaction_count,
        rows,
    })
}

/// Amounts are written in major units with two decimals, derived from the integer minor
/// units by division and remainder — never by floating-point maths.
fn money(cents: i64) -> String {
    let negative = cents < 0;
    let cents = cents.abs();
    let major = cents / 100;
    let minor = cents % 100;

    let digits: Vec<char> = major.to_string().chars().collect();
    let mut grouped = String::new();
    for (i, ch) in digits.iter().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(*ch);
    }
    format!("{}{grouped}.{minor:02}", if negative { "-" } else { "" })
}

fn csv_field(value: &str) -> String {
    if value.contains([',', '"', '\n']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn report_csv(report: &Report) -> String {
    let net = report.income_cents
        - if report.profile_type == "business" {
            report.deductible_cents
        } else {
            report.expense_cents
        };

    let mut out = String::new();
    out.push_str("DEXT category report\n");
    out.push_str(&format!("Profile,{}\n", csv_field(&report.profile_name)));
    out.push_str(&format!("Period,{} to {}\n", report.from_date, report.to_date));
    out.push_str("Basis,Posted transactions only (drafts excluded)\n");
    out.push_str(&format!("Gross income,{}\n", money(report.income_cents)));
    out.push_str(&format!("Total expenses,{}\n", money(report.expense_cents)));
    out.push_str(&format!(
        "Deductible expenses,{}\n",
        money(report.deductible_cents)
    ));
    out.push_str(&format!("Net,{}\n\n", money(net)));

    out.push_str("Category,Type,Deductible,Transactions,Total\n");
    for row in &report.rows {
        out.push_str(&format!(
            "{},{},{},{},{}\n",
            csv_field(&row.name),
            if row.kind == "income" { "Income" } else { "Expense" },
            if row.tax_deductible { "Yes" } else { "No" },
            row.transaction_count,
            money(row.total_cents)
        ));
    }
    out
}

#[tauri::command]
pub fn export_report_csv(
    state: State<'_, AppState>,
    profile_id: i64,
    from_date: String,
    to_date: String,
    path: String,
) -> AppResult<String> {
    let report = {
        let conn = state.conn()?;
        build_report(&conn, profile_id, &from_date, &to_date)?
    };
    let path = PathBuf::from(path);
    std::fs::write(&path, report_csv(&report))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_report_pdf(
    state: State<'_, AppState>,
    profile_id: i64,
    from_date: String,
    to_date: String,
    path: String,
) -> AppResult<String> {
    let report = {
        let conn = state.conn()?;
        build_report(&conn, profile_id, &from_date, &to_date)?
    };
    let path = PathBuf::from(path);
    std::fs::write(&path, report_pdf(&report))?;
    Ok(path.to_string_lossy().to_string())
}

fn report_pdf(report: &Report) -> Vec<u8> {
    let width = pdf::CONTENT_WIDTH;
    // Column right edges, measured from the left margin.
    let col_type = width - 250.0;
    let col_deductible = width - 160.0;
    let col_count = width - 80.0;
    let col_total = width;

    let mut doc = Pdf::new();

    doc.text(0.0, "DEXT category report", 20.0, Font::Bold, Align::Left);
    doc.advance(22.0);
    doc.text(0.0, &report.profile_name, 12.0, Font::Regular, Align::Left);
    doc.advance(16.0);
    doc.text(
        0.0,
        &format!("{} to {}", report.from_date, report.to_date),
        11.0,
        Font::Regular,
        Align::Left,
    );
    doc.advance(14.0);
    doc.text(
        0.0,
        "Posted transactions only. Drafts are excluded. Amounts in NGN.",
        10.0,
        Font::Regular,
        Align::Left,
    );
    doc.advance(26.0);

    let deductions = if report.profile_type == "business" {
        report.deductible_cents
    } else {
        report.expense_cents
    };
    let summary = [
        ("Gross income", report.income_cents),
        ("Total expenses", report.expense_cents),
        ("Deductible expenses", report.deductible_cents),
        (
            if report.profile_type == "business" {
                "Taxable profit"
            } else {
                "Net"
            },
            report.income_cents - deductions,
        ),
    ];
    for (label, amount) in summary {
        doc.text(0.0, label, 11.0, Font::Regular, Align::Left);
        doc.text(col_total, &money(amount), 11.0, Font::Bold, Align::Right);
        doc.advance(16.0);
    }

    doc.advance(10.0);
    doc.rule(0.8, 0.8);
    doc.advance(16.0);

    let header = |doc: &mut Pdf| {
        doc.text(0.0, "CATEGORY", 9.0, Font::Bold, Align::Left);
        doc.text(col_type, "TYPE", 9.0, Font::Bold, Align::Right);
        doc.text(col_deductible, "DEDUCTIBLE", 9.0, Font::Bold, Align::Right);
        doc.text(col_count, "COUNT", 9.0, Font::Bold, Align::Right);
        doc.text(col_total, "TOTAL", 9.0, Font::Bold, Align::Right);
        doc.advance(6.0);
        doc.rule(0.5, 0.85);
        doc.advance(16.0);
    };
    header(&mut doc);

    if report.rows.is_empty() {
        doc.text(
            0.0,
            "No posted transactions in this period.",
            11.0,
            Font::Regular,
            Align::Left,
        );
    }

    for row in &report.rows {
        // A row plus its rule needs ~24pt; break to a new page and repeat the header
        // rather than clipping the last line.
        if !doc.fits(24.0) {
            doc.new_page();
            header(&mut doc);
        }
        let name = pdf::truncate(&row.name, col_type - 20.0, 11.0, Font::Regular);
        doc.text(0.0, &name, 11.0, Font::Regular, Align::Left);
        doc.text(
            col_type,
            if row.kind == "income" { "Income" } else { "Expense" },
            10.0,
            Font::Regular,
            Align::Right,
        );
        doc.text(
            col_deductible,
            if row.tax_deductible { "Yes" } else { "No" },
            10.0,
            Font::Regular,
            Align::Right,
        );
        doc.text(
            col_count,
            &row.transaction_count.to_string(),
            10.0,
            Font::Regular,
            Align::Right,
        );
        doc.text(col_total, &money(row.total_cents), 11.0, Font::Bold, Align::Right);
        doc.advance(9.0);
        doc.rule(0.4, 0.92);
        doc.advance(15.0);
    }

    doc.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn money_groups_thousands_from_integer_minor_units() {
        assert_eq!(money(0), "0.00");
        assert_eq!(money(5), "0.05");
        assert_eq!(money(150_000_00), "150,000.00");
        assert_eq!(money(1_234_567_89), "1,234,567.89");
        assert_eq!(money(-46_800_00), "-46,800.00");
    }

    #[test]
    fn csv_quotes_fields_containing_separators() {
        assert_eq!(csv_field("Office"), "Office");
        assert_eq!(csv_field("Meals, drinks"), "\"Meals, drinks\"");
        assert_eq!(csv_field("He said \"hi\""), "\"He said \"\"hi\"\"\"");
    }
}
