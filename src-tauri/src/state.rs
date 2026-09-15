use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::AppResult;

/// One connection, guarded by a mutex. SQLite serialises writes anyway and Dema is a
/// single-user local app, so a pool would buy nothing.
pub struct AppState {
    pub db: Mutex<Connection>,
}

impl AppState {
    pub fn new(db: Connection) -> Self {
        Self { db: Mutex::new(db) }
    }

    /// Locks the connection, recovering from a poisoned mutex rather than propagating the
    /// poison: a command that panicked mid-query must not brick every later command.
    /// An in-flight `Transaction` rolls back on unwind, so the recovered connection is clean.
    pub fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        Ok(self.db.lock().unwrap_or_else(|poisoned| poisoned.into_inner()))
    }
}
