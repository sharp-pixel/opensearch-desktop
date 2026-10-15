// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { registerRequest } = require('../shared/node/requests.cjs');

function createHttpProxy(fetch) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid HTTP endpoint');
    const controller = new AbortController();
    const release = registerRequest(options.requestId, () => controller.abort());
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: options.method || 'GET', headers: options.headers || {},
        body: options.body || undefined, signal: controller.signal,
        // Never forward localhost certificate exceptions or credentials through redirects.
        redirect: 'manual',
      });
      const text = await response.text();
      let body = text;
      try { body = JSON.parse(text); } catch { /* Plain-text endpoints remain plain text. */ }
      return { ok: response.ok, status: response.status, statusText: response.statusText,
        headers: Object.fromEntries(response.headers), body };
    } catch (error) {
      return { ok: false, status: 0, statusText: 'Network Error', body: null,
        error: error instanceof Error ? error.message : 'Failed to fetch' };
    } finally { clearTimeout(timer); release(); }
  };
}
module.exports = { createHttpProxy };
