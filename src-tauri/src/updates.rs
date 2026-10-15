// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

//! Signed, user-initiated app replacement. Only AppImage and macOS bundles are supported.
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, State};
#[cfg(target_os = "linux")]
use tauri::Manager;
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    version: String,
    notes: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    version: String,
    supported: bool,
    configured: bool,
    reason: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    info: Info,
    phase: String,
    release: Option<Release>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
}
struct Session {
    phase: &'static str,
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
}
impl Default for Session {
    fn default() -> Self {
        Self {
            phase: "idle",
            update: None,
            bytes: None,
            downloaded_bytes: 0,
            total_bytes: None,
        }
    }
}
#[derive(Default)]
pub struct UpdateState {
    session: Mutex<Session>,
    operation: tokio::sync::Mutex<()>,
}

fn deployment_supported(_app: &AppHandle) -> bool {
    #[cfg(target_os = "linux")]
    {
        _app.env()
            .appimage
            .is_some_and(|path| std::path::Path::new(&path).is_file())
    }
    #[cfg(target_os = "macos")]
    {
        std::env::current_exe().is_ok_and(|path| {
            path.ancestors().any(|parent| {
                parent
                    .extension()
                    .is_some_and(|extension| extension == "app")
            })
        })
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        false
    }
}
fn info(app: &AppHandle) -> Info {
    let supported = deployment_supported(app);
    let config = app.config().plugins.0.get("updater");
    let configured = config.is_some_and(|value| {
        value
            .get("pubkey")
            .and_then(|key| key.as_str())
            .is_some_and(|key| !key.trim().is_empty())
            && value
                .get("endpoints")
                .and_then(|urls| urls.as_array())
                .is_some_and(|urls| !urls.is_empty())
    });
    let reason = if !supported {
        Some("In-app updates are available in the Tauri AppImage and macOS app.".into())
    } else if !configured {
        Some("Updates are not configured for this build.".into())
    } else {
        None
    };
    Info {
        version: app.package_info().version.to_string(),
        supported,
        configured,
        reason,
    }
}
fn ready(app: &AppHandle) -> Result<(), String> {
    let info = info(app);
    match info.reason {
        Some(reason) => Err(reason),
        None => Ok(()),
    }
}
fn snapshot(app: &AppHandle, state: &UpdateState) -> Result<Status, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "Update state is unavailable")?;
    Ok(Status {
        info: info(app),
        phase: session.phase.into(),
        release: session.update.as_ref().map(|update| Release {
            version: update.version.clone(),
            notes: update.body.clone(),
        }),
        downloaded_bytes: session.downloaded_bytes,
        total_bytes: session.total_bytes,
    })
}
fn secure_artifact(update: &Update) -> Result<(), String> {
    secure_url(update.download_url.as_str())
}
fn secure_url(value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid update URL.")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Update downloads require HTTPS without embedded credentials.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn updater_status(app: AppHandle, state: State<'_, UpdateState>) -> Result<Status, String> {
    snapshot(&app, &state)
}

#[tauri::command]
pub async fn updater_check(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Status, String> {
    ready(&app)?;
    let _operation = state
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running.")?;
    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        if matches!(session.phase, "downloaded" | "installed") {
            return Err("Restart to finish the downloaded update.".into());
        }
        *session = Session {
            phase: "checking",
            ..Session::default()
        };
    }
    let result = async {
        let updater = app
            .updater_builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;
        let mut update = updater.check().await.map_err(|e| e.to_string())?;
        if let Some(update) = &mut update {
            update.timeout = Some(Duration::from_secs(15 * 60));
        }
        if let Some(update) = &update {
            secure_artifact(update)?;
        }
        Ok::<_, String>(update)
    }
    .await;
    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        session.phase = "idle";
        session.update = result?;
        if session.update.is_some() {
            session.phase = "available";
        }
    }
    snapshot(&app, &state)
}

#[tauri::command]
pub async fn updater_download(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Status, String> {
    ready(&app)?;
    let _operation = state
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running.")?;
    let update = {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        if session.phase != "available" {
            return Err("Check for an update before downloading.".into());
        }
        let update = session.update.clone().ok_or("No update is available.")?;
        secure_artifact(&update)?;
        session.phase = "downloading";
        session.downloaded_bytes = 0;
        session.total_bytes = None;
        update
    };
    // The plugin verifies the signature before returning any installable bytes.
    let result = update
        .download(
            |chunk, total| {
                if let Ok(mut session) = state.session.lock() {
                    session.downloaded_bytes =
                        session.downloaded_bytes.saturating_add(chunk as u64);
                    session.total_bytes = total;
                }
            },
            || {},
        )
        .await;
    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        session.phase = "available";
        session.bytes = Some(result.map_err(|e| e.to_string())?);
        session.phase = "downloaded";
    }
    snapshot(&app, &state)
}

#[tauri::command]
pub async fn updater_install(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Status, String> {
    ready(&app)?;
    let _operation = state
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running.")?;
    let (update, bytes) = {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        if session.phase != "downloaded" {
            return Err("Download and verify the update before installing.".into());
        }
        let update = session.update.clone().ok_or("No update is available.")?;
        let bytes = session
            .bytes
            .take()
            .ok_or("No verified update is available.")?;
        session.phase = "installing";
        (update, bytes)
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        let result = update.install(&bytes).map_err(|e| e.to_string());
        (result, bytes)
    })
    .await;
    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        session.phase = "available";
        let (installed, bytes) = result.map_err(|e| e.to_string())?;
        if let Err(error) = installed {
            session.bytes = Some(bytes);
            session.phase = "downloaded";
            return Err(error);
        }
        session.phase = "installed";
    }
    snapshot(&app, &state)
}

#[tauri::command]
pub fn updater_restart(app: AppHandle, state: State<'_, UpdateState>) -> Result<(), String> {
    {
        let session = state
            .session
            .lock()
            .map_err(|_| "Update state is unavailable")?;
        if session.phase != "installed" {
            return Err("Install a verified update before restarting.".into());
        }
    }
    app.request_restart();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn update_artifacts_require_https_even_in_development() {
        assert!(
            secure_url("https://github.com/owner/repo/releases/download/v1/app.AppImage").is_ok()
        );
        for url in [
            "http://github.com/owner/repo/app.AppImage",
            "file:///tmp/update",
            "invalid",
            "https://user:secret@github.com/update",
        ] {
            assert!(secure_url(url).is_err());
        }
    }
}
