// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const MAX_BYTES: u64 = 100 * 1024 * 1024;

pub struct DocumentAccess {
    paths: Mutex<HashSet<PathBuf>>,
    operation: Mutex<()>,
}

#[derive(Serialize)]
pub struct DocumentFile {
    path: String,
    name: String,
    content: String,
    revision: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    title: Option<String>,
    path: Option<String>,
    suggested_name: String,
    content: String,
    expected_revision: Option<String>,
}

#[derive(Deserialize)]
pub struct OpenOptions {
    title: Option<String>,
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("document-access.json"))
}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    let paths = registry_path(app)
        .ok()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<HashSet<PathBuf>>(&bytes).ok())
        .unwrap_or_default();
    app.manage(DocumentAccess {
        paths: Mutex::new(paths),
        operation: Mutex::new(()),
    });
    Ok(())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid file location")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    if let Ok(metadata) = std::fs::metadata(path) {
        temp.as_file()
            .set_permissions(metadata.permissions())
            .map_err(|e| e.to_string())?;
    }
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

fn grant(app: &AppHandle, path: &Path) -> Result<(), String> {
    let state = app.state::<DocumentAccess>();
    let mut paths = state.paths.lock().map_err(|e| e.to_string())?;
    let mut next = paths.clone();
    next.insert(path.to_path_buf());
    let registry = registry_path(app)?;
    std::fs::create_dir_all(registry.parent().unwrap()).map_err(|e| e.to_string())?;
    atomic_write(
        &registry,
        &serde_json::to_vec(&next).map_err(|e| e.to_string())?,
    )?;
    *paths = next;
    Ok(())
}

fn authorized(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let value = PathBuf::from(path);
    if !app
        .state::<DocumentAccess>()
        .paths
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&value)
    {
        return Err("Locate this file with Open before accessing it.".into());
    }
    let resolved = value
        .canonicalize()
        .map_err(|e| format!("File unavailable. Locate it again: {e}"))?;
    if resolved != value {
        return Err("File location changed. Locate it again.".into());
    }
    Ok(value)
}

fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn read(path: &Path) -> Result<DocumentFile, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Choose a regular JSON file.".into());
    }
    if metadata.len() > MAX_BYTES {
        return Err("Document files must be smaller than 100 MiB.".into());
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let digest = revision(&bytes);
    let content = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    Ok(DocumentFile {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        content,
        revision: digest,
    })
}

#[tauri::command]
pub async fn document_open(
    app: AppHandle,
    options: Option<OpenOptions>,
) -> Result<Option<DocumentFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<DocumentAccess>();
        let _operation = state.operation.lock().map_err(|e| e.to_string())?;
        let window = app
            .get_webview_window("main")
            .ok_or("Application window is unavailable")?;
        let Some(file) = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title(
                options
                    .and_then(|value| value.title)
                    .unwrap_or_else(|| "Open notebook".into()),
            )
            .add_filter("JSON documents", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|e| e.to_string())?
            .canonicalize()
            .map_err(|e| e.to_string())?;
        let document = read(&path)?;
        grant(&app, &path)?;
        Ok(Some(document))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn document_read(app: AppHandle, path: String) -> Result<DocumentFile, String> {
    tauri::async_runtime::spawn_blocking(move || read(&authorized(&app, &path)?))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn document_save(
    app: AppHandle,
    request: SaveRequest,
) -> Result<Option<DocumentFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<DocumentAccess>();
        let _operation = state.operation.lock().map_err(|e| e.to_string())?;
        if request.content.len() as u64 > MAX_BYTES {
            return Err("Document files must be smaller than 100 MiB.".into());
        }
        let _: serde_json::Value =
            serde_json::from_str(&request.content).map_err(|e| e.to_string())?;
        let path = if let Some(path) = &request.path {
            let path = authorized(&app, path)?;
            let current = read(&path)?;
            if request.expected_revision.as_deref() != Some(&current.revision) {
                return Err(
                    "File changed on disk. Open it again or use Save As to preserve your changes."
                        .into(),
                );
            }
            path
        } else {
            let name = Path::new(&request.suggested_name)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy();
            let window = app
                .get_webview_window("main")
                .ok_or("Application window is unavailable")?;
            let Some(file) = app
                .dialog()
                .file()
                .set_parent(&window)
                .set_title(request.title.unwrap_or_else(|| "Save notebook as".into()))
                .add_filter("JSON documents", &["json"])
                .set_file_name(name)
                .blocking_save_file()
            else {
                return Ok(None);
            };
            let path = file.into_path().map_err(|e| e.to_string())?;
            if !path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
            {
                return Err("Choose a filename ending in .json.".into());
            }
            let path = if path.exists() {
                path.canonicalize().map_err(|e| e.to_string())?
            } else {
                path.parent()
                    .ok_or("Invalid file location")?
                    .canonicalize()
                    .map_err(|e| e.to_string())?
                    .join(path.file_name().ok_or("Invalid filename")?)
            };
            // Remember only locations explicitly chosen in a native dialog.
            grant(&app, &path)?;
            path
        };
        atomic_write(&path, request.content.as_bytes())?;
        Ok(Some(DocumentFile {
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            path: path.to_string_lossy().into_owned(),
            revision: revision(request.content.as_bytes()),
            content: request.content,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn atomic_save_replaces_contents_and_returns_a_new_revision() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notebook.json");
        atomic_write(&path, b"{\"old\":true}").unwrap();
        let previous = read(&path).unwrap();
        atomic_write(&path, b"{\"new\":true}").unwrap();
        let next = read(&path).unwrap();
        assert_ne!(previous.revision, next.revision);
        assert_eq!(next.content, "{\"new\":true}");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
