// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

function isTrustedUrl(value, entryUrl) {
  try {
    const url = new URL(value);
    const entry = new URL(entryUrl);
    return url.protocol === entry.protocol && url.host === entry.host &&
      url.pathname === entry.pathname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isTrustedSender(event, webContents, entryUrl) {
  return !!webContents && event.sender === webContents &&
    !!event.senderFrame && event.senderFrame === webContents.mainFrame &&
    isTrustedUrl(event.senderFrame.url, entryUrl);
}

function configureNavigation(webContents, shell, entryUrl) {
  const openExternal = (value) => {
    try {
      const url = new URL(value);
      if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
        void shell.openExternal(url.href).catch(() => {});
      }
    } catch {
      // Invalid or unsupported links must never reach the OS shell.
    }
  };
  webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url, entryUrl)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  webContents.on('will-redirect', (event, url) => {
    if (!isTrustedUrl(url, entryUrl)) event.preventDefault();
  });
  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
}

/** Install before any requests: Chromium caches certificate verification results. */
function configureLocalCertificates(session) {
  session.setCertificateVerifyProc(({ hostname }, callback) => {
    // net.fetch uses the default session and does not use the renderer's certificate-error flow.
    // All other hosts keep Chromium's normal certificate verification (-3).
    callback(hostname === 'localhost' || hostname === '127.0.0.1' ? 0 : -3);
  });
}

module.exports = { isTrustedSender, configureNavigation, configureLocalCertificates };
