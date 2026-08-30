use std::path::Path;

use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

use crate::error::AppResult;

/// Versioned, append-only. Never edit a migration that has shipped — add a new one.
fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("migrations/0001_init.sql")),
        M::up(include_str!("migrations/0002_app_settings.sql")),
    ])
}

/// Opens the ledger database, applies the PRAGMAs every connection needs, and brings the
/// schema up to date.
pub fn open(path: &Path) -> AppResult<Connection> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrations().to_latest(&mut conn)?;
    Ok(conn)
}

/// PRAGMAs are per-connection, not per-database, so they are set every time we open.
fn configure(conn: &Connection) -> AppResult<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}

#[cfg(test)]
pub fn open_in_memory() -> AppResult<Connection> {
    let mut conn = Connection::open_in_memory()?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations().to_latest(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        assert!(migrations().validate().is_ok());
    }

    #[test]
    fn seeds_builtin_categories_for_both_profile_types() {
        let conn = open_in_memory().unwrap();
        let personal: i64 = conn
            .query_row(
                "SELECT count(*) FROM categories WHERE is_builtin = 1 AND profile_type = 'personal'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let business: i64 = conn
            .query_row(
                "SELECT count(*) FROM categories WHERE is_builtin = 1 AND profile_type = 'business'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(personal, 8);
        assert_eq!(business, 8);
    }
}
