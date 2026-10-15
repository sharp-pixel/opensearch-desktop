// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { randomUUID } = require('crypto');

/** Only a reply to the current, main-process-issued close request may destroy the window. */
function createWindowCloseGuard(window) {
  let watching = null;
  let request = null;
  const close = event => {
    if (!watching) return;
    event.preventDefault();
    request ??= randomUUID();
    window.webContents.send('window:close-requested', watching, request);
  };
  window.on('close', close);
  return {
    watch(id, enabled) {
      if (typeof id !== 'string' || !id || id.length > 100) return;
      if (enabled === true) { watching = id; request = null; }
      else if (watching === id) { watching = null; request = null; }
    },
    complete(id, allowed) {
      if (!request || id !== request) return;
      request = null;
      if (allowed === true) window.destroy();
    },
  };
}
module.exports = { createWindowCloseGuard };
