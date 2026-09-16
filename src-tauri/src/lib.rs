mod commands;
mod db;
mod error;
mod models;
mod pdf;
mod state;

#[cfg(test)]
mod tests;

use tauri::Manager;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // The ledger lives beside the app's own data, not in the user's Documents.
            let path = app.path().app_data_dir()?.join("dema.sqlite3");
            let conn = db::open(&path)?;
            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profile::list_profiles,
            commands::profile::create_profile,
            commands::profile::rename_profile,
            commands::category::list_categories,
            commands::category::create_category,
            commands::category::update_category,
            commands::category::delete_category,
            commands::category::restore_category,
            commands::category::set_category_hidden,
            commands::transaction::list_transactions,
            commands::transaction::create_transaction,
            commands::transaction::update_transaction,
            commands::transaction::post_transaction,
            commands::transaction::delete_transaction,
            commands::transaction::dashboard_summary,
            commands::client::list_clients,
            commands::client::create_client,
            commands::client::update_client,
            commands::client::delete_client,
            commands::invoice::list_invoices,
            commands::invoice::get_invoice,
            commands::invoice::next_invoice_number,
            commands::invoice::create_invoice,
            commands::invoice::update_invoice,
            commands::invoice::send_invoice,
            commands::invoice::mark_invoice_paid,
            commands::invoice::reopen_invoice,
            commands::invoice::delete_invoice,
            commands::invoice::invoice_summary,
            commands::invoice::invoice_document,
            commands::invoice::set_invoice_rows,
            commands::business::get_business_details,
            commands::business::set_business_details,
            commands::report::category_report,
            commands::report::export_report_csv,
            commands::report::export_report_pdf,
            commands::settings::get_settings,
            commands::settings::set_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dema");
}
