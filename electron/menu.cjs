// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

function createApplicationMenu({ Menu, app, getWindow, platform = process.platform }) {
  const mac = platform === 'darwin';
  const action = (id, label, accelerator) => ({ id, label, accelerator, enabled: false,
    click: () => {
      const window = getWindow();
      if (window && !window.isDestroyed()) window.webContents.send('menu:action', id);
    },
  });
  const preferences = action('preferences', 'Preferences…', 'CmdOrCtrl+,');
  const menu = Menu.buildFromTemplate([
    ...(mac ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' }, preferences, { type: 'separator' },
      { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' },
      { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] }] : []),
    { id: 'file', label: 'File', submenu: [
      action('new', 'New', 'CmdOrCtrl+N'), action('open', 'Open…', 'CmdOrCtrl+O'), action('recent', 'Recent files'),
      { type: 'separator' }, action('save', 'Save', 'CmdOrCtrl+S'), action('save-as', 'Save As…', 'CmdOrCtrl+Shift+S'),
      { type: 'separator' }, { role: 'close' }, ...(!mac ? [{ role: 'quit' }] : []),
    ] },
    { id: 'edit', label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' },
      { role: 'paste' }, { role: 'selectAll' }, ...(!mac ? [{ type: 'separator' }, preferences] : []),
    ] },
    { id: 'window', label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'togglefullscreen' }] },
  ]);
  Menu.setApplicationMenu(menu);
  const actions = ['new', 'open', 'recent', 'save', 'save-as', 'preferences'];
  return {
    update(state) {
      for (const id of [...actions, 'file', 'edit', 'window']) {
        const item = menu.getMenuItemById(id);
        const label = state?.labels?.[id];
        if (typeof label === 'string') item.label = label;
        if (actions.includes(id)) item.enabled = state?.enabled?.[id] === true;
      }
    },
  };
}
module.exports = { createApplicationMenu };
