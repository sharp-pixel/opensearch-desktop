// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { DocumentFileAccess } from './contracts';

/** Browser fallback: open a local copy and download saves; never claim a filesystem path. */
export const browserDocumentFiles: DocumentFileAccess = {
  open: () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.hidden = true;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { done = true; clearTimeout(timer); window.removeEventListener('focus', onFocus); input.remove(); };
    const onFocus = () => {
      // Older browsers may return focus without dispatching the input's cancel event.
      timer = setTimeout(() => { if (!done && !input.files?.length) { cleanup(); resolve(null); } }, 300);
    };
    window.addEventListener('focus', onFocus);
    input.addEventListener('cancel', () => { cleanup(); resolve(null); }, { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      if (file.size > 100 * 1024 * 1024) { reject(new Error('Document files must be smaller than 100 MiB.')); return; }
      void file.text().then(content => resolve({ path: null, name: file.name, content, revision: '' }), reject);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  }),
  read: async () => { throw new Error('Open the file again to access it in the browser.'); },
  async save({ suggestedName, content }) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    try { link.click(); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return { path: null, name: suggestedName, content, revision: '' };
  },
};
