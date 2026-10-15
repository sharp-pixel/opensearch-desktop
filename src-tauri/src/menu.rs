// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

use std::collections::HashMap;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

struct DesktopMenu {
    actions: HashMap<&'static str, MenuItem<tauri::Wry>>,
    groups: HashMap<&'static str, Submenu<tauri::Wry>>,
}

#[derive(serde::Deserialize)]
pub struct MenuState {
    labels: HashMap<String, String>,
    enabled: HashMap<String, bool>,
}

pub fn initialize(app: &AppHandle) -> tauri::Result<()> {
    let mut actions = HashMap::new();
    for (id, label, accelerator) in [
        ("new", "New", Some("CmdOrCtrl+N")),
        ("open", "Open…", Some("CmdOrCtrl+O")),
        ("recent", "Recent files", None),
        ("save", "Save", Some("CmdOrCtrl+S")),
        ("save-as", "Save As…", Some("CmdOrCtrl+Shift+S")),
        ("preferences", "Preferences…", Some("CmdOrCtrl+,")),
    ] {
        actions.insert(id, MenuItem::with_id(app, id, label, false, accelerator)?);
    }
    let file = Submenu::with_id_and_items(app, "file", "File", true, &[
        &actions["new"], &actions["open"], &actions["recent"],
        &PredefinedMenuItem::separator(app)?,
        &actions["save"], &actions["save-as"],
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::close_window(app, None)?,
        #[cfg(not(target_os = "macos"))]
        &PredefinedMenuItem::quit(app, None)?,
    ])?;
    let edit = Submenu::with_id_and_items(app, "edit", "Edit", true, &[
        &PredefinedMenuItem::undo(app, None)?,
        &PredefinedMenuItem::redo(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::cut(app, None)?,
        &PredefinedMenuItem::copy(app, None)?,
        &PredefinedMenuItem::paste(app, None)?,
        &PredefinedMenuItem::select_all(app, None)?,
        #[cfg(not(target_os = "macos"))]
        &PredefinedMenuItem::separator(app)?,
        #[cfg(not(target_os = "macos"))]
        &actions["preferences"],
    ])?;
    let window = Submenu::with_id_and_items(app, "window", "Window", true, &[
        &PredefinedMenuItem::minimize(app, None)?,
        &PredefinedMenuItem::maximize(app, None)?,
        &PredefinedMenuItem::fullscreen(app, None)?,
    ])?;
    let menu = Menu::with_items(app, &[
        #[cfg(target_os = "macos")]
        &Submenu::with_items(app, "OpenSearch Developer Workbench", true, &[
            &PredefinedMenuItem::about(app, None, None)?,
            &PredefinedMenuItem::separator(app)?,
            &actions["preferences"],
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ])?,
        &file, &edit, &window,
    ])?;
    app.set_menu(menu)?;
    app.manage(DesktopMenu { actions, groups: HashMap::from([("file", file), ("edit", edit), ("window", window)]) });
    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if app.state::<DesktopMenu>().actions.contains_key(id) {
            let _ = app.emit_to("main", "workbench-menu", id);
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn update_menu(app: AppHandle, state: MenuState) -> Result<(), String> {
    let menu = app.state::<DesktopMenu>();
    for (id, item) in &menu.actions {
        if let Some(label) = state.labels.get(*id) {
            item.set_text(label).map_err(|error| error.to_string())?;
        }
        item.set_enabled(state.enabled.get(*id).copied().unwrap_or(false))
            .map_err(|error| error.to_string())?;
    }
    for (id, group) in &menu.groups {
        if let Some(label) = state.labels.get(*id) {
            group.set_text(label).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}
