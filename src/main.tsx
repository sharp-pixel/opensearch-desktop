// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t } from './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeWorkspaceStorage } from './storage/bootstrap';
import './styles.css';
import { initializePlatform } from './platform/runtime';

initializePlatform();

const root = ReactDOM.createRoot(document.getElementById('root')!);
async function start() {
  root.render(<p role="status">{t('Opening workspace…')}</p>);
  try {
    await initializeWorkspaceStorage();
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } catch (error) {
    root.render(<main style={{ padding: 32 }}>
      <h1>{t('Unable to open your workspace')}</h1>
      <p role="alert">{error instanceof Error ? error.message : t('Storage is unavailable')}</p>
      <p>{t('Your existing data has been preserved.')}</p>
      <button onClick={() => void start()}>{t('Retry')}</button>
    </main>);
  }
}
void start();
