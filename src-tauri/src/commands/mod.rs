pub mod category;
pub mod client;
pub mod invoice;
pub mod profile;
pub mod report;
pub mod settings;
pub mod transaction;

use crate::error::{AppError, AppResult};

/// Validates a value against the same closed set the schema's CHECK constraint enforces,
/// so a bad argument fails with a readable message instead of a SQLite constraint error.
pub fn one_of(field: &str, value: &str, allowed: &[&str]) -> AppResult<String> {
    if allowed.contains(&value) {
        Ok(value.to_string())
    } else {
        Err(AppError::Validation(format!(
            "{field} must be one of {}.",
            allowed.join(", ")
        )))
    }
}

/// Trims, and turns an empty string into None so optional text columns stay NULL
/// rather than storing "".
pub fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

pub fn require_text(field: &str, value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{field} is required.")));
    }
    Ok(trimmed.to_string())
}
