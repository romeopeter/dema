use serde::{Serialize, Serializer};

/// Every command returns `Result<T, AppError>`. Serialising as a tagged object keeps
/// raw SQLite text out of the UI while still giving the frontend something to branch on.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Could not read or write your data.")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Could not prepare the database.")]
    Migration(#[from] rusqlite_migration::Error),

    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    Validation(String),

    #[error("{0}")]
    Conflict(String),

    #[error("Could not write the file.")]
    Io(#[from] std::io::Error),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            AppError::Sqlite(_) => "database",
            AppError::Migration(_) => "migration",
            AppError::NotFound(_) => "not_found",
            AppError::Validation(_) => "validation",
            AppError::Conflict(_) => "conflict",
            AppError::Io(_) => "io",
        }
    }

    /// Developer-facing text. Kept out of `message` so the UI never shows SQLite internals.
    fn detail(&self) -> Option<String> {
        match self {
            AppError::Sqlite(e) => Some(e.to_string()),
            AppError::Migration(e) => Some(e.to_string()),
            AppError::Io(e) => Some(e.to_string()),
            _ => None,
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 3)?;
        s.serialize_field("kind", self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        s.serialize_field("detail", &self.detail())?;
        s.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
