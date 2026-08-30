use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRow {
    pub category_id: i64,
    pub name: String,
    pub color: String,
    pub kind: String,
    pub tax_deductible: bool,
    pub transaction_count: i64,
    pub total_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub profile_id: i64,
    pub profile_name: String,
    pub profile_type: String,
    pub from_date: String,
    pub to_date: String,
    pub income_cents: i64,
    pub expense_cents: i64,
    /// Expenses in categories flagged `tax_deductible`.
    pub deductible_cents: i64,
    pub transaction_count: i64,
    pub rows: Vec<ReportRow>,
}
