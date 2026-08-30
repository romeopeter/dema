use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub profile_id: Option<i64>,
    pub profile_type: Option<String>,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub kind: String,
    pub is_builtin: bool,
    pub tax_deductible: bool,
    pub is_deleted: bool,
    pub sort_order: i64,
    /// Per-profile visibility for built-ins. Custom categories use `is_deleted` instead.
    pub is_hidden: bool,
    /// How many transactions reference it — the UI warns before archiving a used category.
    pub transaction_count: i64,
}

impl Category {
    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            profile_id: row.get("profile_id")?,
            profile_type: row.get("profile_type")?,
            name: row.get("name")?,
            icon: row.get("icon")?,
            color: row.get("color")?,
            kind: row.get("kind")?,
            is_builtin: row.get::<_, i64>("is_builtin")? != 0,
            tax_deductible: row.get::<_, i64>("tax_deductible")? != 0,
            is_deleted: row.get::<_, i64>("is_deleted")? != 0,
            sort_order: row.get("sort_order")?,
            is_hidden: row.get::<_, i64>("is_hidden")? != 0,
            transaction_count: row.get("transaction_count")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCategory {
    pub profile_id: i64,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub kind: String,
    #[serde(default)]
    pub tax_deductible: bool,
}
