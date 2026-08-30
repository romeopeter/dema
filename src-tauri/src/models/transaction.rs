use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// A `transactions` row joined to the bits every list needs, so the UI never has to
/// stitch categories and invoices together itself. This is the only shape a transaction
/// crosses the IPC boundary in.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: i64,
    pub profile_id: i64,
    pub amount_cents: i64,
    pub category_id: i64,
    pub category_name: String,
    pub category_icon: String,
    pub category_color: String,
    pub payment_type: String,
    pub status: String,
    pub kind: String,
    pub date: String,
    pub note: Option<String>,
    pub invoice_id: Option<i64>,
    pub invoice_number: Option<String>,
}

impl TransactionRow {
    pub const SELECT: &'static str = "
        SELECT t.id, t.profile_id, t.amount_cents, t.category_id, t.payment_type,
               t.status, t.kind, t.date, t.note, t.invoice_id,
               c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
               i.invoice_number AS invoice_number
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        LEFT JOIN invoices i ON i.id = t.invoice_id";

    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            profile_id: row.get("profile_id")?,
            amount_cents: row.get("amount_cents")?,
            category_id: row.get("category_id")?,
            category_name: row.get("category_name")?,
            category_icon: row.get("category_icon")?,
            category_color: row.get("category_color")?,
            payment_type: row.get("payment_type")?,
            status: row.get("status")?,
            kind: row.get("kind")?,
            date: row.get("date")?,
            note: row.get("note")?,
            invoice_id: row.get("invoice_id")?,
            invoice_number: row.get("invoice_number")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    pub profile_id: i64,
    pub amount_cents: i64,
    pub category_id: i64,
    pub payment_type: String,
    pub status: String,
    pub kind: String,
    pub date: String,
    #[serde(default)]
    pub note: Option<String>,
}

/// Dashboard figures. Drafts are excluded upstream, in SQL.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub income_cents: i64,
    pub spent_cents: i64,
    pub net_cents: i64,
    pub draft_count: i64,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub top_categories: Vec<CategoryTotal>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category_id: i64,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub kind: String,
    pub total_cents: i64,
    /// Share of the period's total spend, 0 to 100. The UI scales bars against the
    /// largest row so the leader fills the track.
    pub percent: i64,
}
