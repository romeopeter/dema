use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    pub id: i64,
    pub profile_id: i64,
    pub client_id: i64,
    pub client_name: String,
    pub client_address: Option<String>,
    pub invoice_number: String,
    pub issue_date: String,
    pub due_date: String,
    /// What is stored: draft | sent | paid.
    pub status: String,
    /// What to show: a sent invoice past its due date reads as `overdue`. Derived, never stored,
    /// so it stays correct without a background job ever touching the row.
    pub display_status: String,
    pub subtotal_cents: i64,
    pub vat_rate_bp: i64,
    pub vat_cents: i64,
    pub total_amount_cents: i64,
    pub notes: Option<String>,
    pub paid_at: Option<String>,
    /// The income transaction created when this invoice was marked paid.
    pub transaction_id: Option<i64>,
}

impl Invoice {
    pub const SELECT: &'static str = "
        SELECT i.id, i.profile_id, i.client_id, i.invoice_number, i.issue_date, i.due_date,
               i.status, i.subtotal_cents, i.vat_rate_bp, i.vat_cents, i.total_amount_cents,
               i.notes, i.paid_at,
               CASE WHEN i.status = 'sent' AND i.due_date < date('now', 'localtime')
                    THEN 'overdue' ELSE i.status END AS display_status,
               cl.name AS client_name, cl.address AS client_address,
               (SELECT t.id FROM transactions t WHERE t.invoice_id = i.id) AS transaction_id
        FROM invoices i
        JOIN clients cl ON cl.id = i.client_id";

    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            profile_id: row.get("profile_id")?,
            client_id: row.get("client_id")?,
            client_name: row.get("client_name")?,
            client_address: row.get("client_address")?,
            invoice_number: row.get("invoice_number")?,
            issue_date: row.get("issue_date")?,
            due_date: row.get("due_date")?,
            status: row.get("status")?,
            display_status: row.get("display_status")?,
            subtotal_cents: row.get("subtotal_cents")?,
            vat_rate_bp: row.get("vat_rate_bp")?,
            vat_cents: row.get("vat_cents")?,
            total_amount_cents: row.get("total_amount_cents")?,
            notes: row.get("notes")?,
            paid_at: row.get("paid_at")?,
            transaction_id: row.get("transaction_id")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItem {
    pub id: i64,
    pub invoice_id: i64,
    pub description: String,
    pub quantity: f64,
    pub unit_price_cents: i64,
    pub position: i64,
    /// quantity * unit_price, rounded to whole minor units once, here.
    pub amount_cents: i64,
}

impl LineItem {
    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        let quantity: f64 = row.get("quantity")?;
        let unit_price_cents: i64 = row.get("unit_price_cents")?;
        Ok(Self {
            id: row.get("id")?,
            invoice_id: row.get("invoice_id")?,
            description: row.get("description")?,
            quantity,
            unit_price_cents,
            position: row.get("position")?,
            amount_cents: line_amount_cents(quantity, unit_price_cents),
        })
    }
}

/// The single place a quantity ever meets a price. Quantity is a real (0.5 days, 2.25 hours),
/// so the product is rounded to whole minor units immediately and everything downstream —
/// subtotal, VAT, invoice total, the posted transaction — stays integer arithmetic.
pub fn line_amount_cents(quantity: f64, unit_price_cents: i64) -> i64 {
    (quantity * unit_price_cents as f64).round() as i64
}

/// VAT on an integer subtotal, in basis points. Integer maths, rounded half-up.
pub fn vat_cents(subtotal_cents: i64, vat_rate_bp: i64) -> i64 {
    (subtotal_cents * vat_rate_bp + 5_000) / 10_000
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceDetail {
    #[serde(flatten)]
    pub invoice: Invoice,
    pub items: Vec<LineItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItemInput {
    pub description: String,
    pub quantity: f64,
    pub unit_price_cents: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceInput {
    pub profile_id: i64,
    pub client_id: i64,
    pub issue_date: String,
    pub due_date: String,
    /// draft | sent
    pub status: String,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub vat_rate_bp: Option<i64>,
    pub items: Vec<LineItemInput>,
}

/// Header figures for the business dashboard's Invoices card.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceSummary {
    pub outstanding_cents: i64,
    pub draft_count: i64,
    pub sent_count: i64,
    pub overdue_count: i64,
    pub paid_count: i64,
}
