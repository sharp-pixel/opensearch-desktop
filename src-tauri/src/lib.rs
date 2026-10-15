// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

mod aws;
mod storage;
mod grpc;
mod http;
mod requests;
mod documents;
mod updates;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            // AWS commands
            aws::get_aws_profiles,
            aws::get_aws_profile_credentials,
            aws::refresh_aws_profiles,
            // Secure storage commands
            storage::safe_storage_is_available,
            storage::safe_storage_encrypt,
            storage::safe_storage_decrypt,
            storage::safe_storage_delete,
            // HTTP proxy for self-signed certs
            http::fetch_proxy,
            requests::cancel_request,
            grpc::grpc_execute,
            documents::document_open,
            documents::document_read,
            documents::document_save,
            updates::updater_status,
            updates::updater_check,
            updates::updater_download,
            updates::updater_install,
            updates::updater_restart,
            menu::update_menu,
            // Platform info
            get_platform,
            is_tauri,
        ])
        .setup(|_app| {
            documents::initialize(_app.handle()).map_err(std::io::Error::other)?;
            menu::initialize(_app.handle())?;
            // Open devtools in debug builds
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code == Some(tauri::RESTART_EXIT_CODE) { return; }
                use tauri::Manager;
                // Route Quit through the same renderer save negotiation as the window close button.
                if let Some(window) = app.get_webview_window("main") {
                    api.prevent_exit();
                    let _ = window.close();
                }
            }
        });
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn is_tauri() -> bool {
    true
}

