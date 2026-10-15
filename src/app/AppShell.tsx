// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../i18n';
import { lazy, Suspense, useState } from 'react';
import { AppProvider } from './AppProviders';
import { ThemeProvider } from '../context/ThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { ActiveFeature } from '../components/Layout/FeatureTabs';

const Notebook = lazy(() => import('../features/notebook/ui/NotebookWorkspace').then(module => ({ default: module.NotebookWorkspace })));
const DataPrepper = lazy(() => import('../features/dataprepper/ui/DataPrepperWorkbench').then(module => ({ default: module.DataPrepperWorkbench })));
const ISM = lazy(() => import('../features/ism/ui/ISMPolicyAnalyzer').then(module => ({ default: module.ISMPolicyAnalyzer })));
const Investigation = lazy(() => import('../features/investigation/ui/InvestigationWorkspace').then(module => ({ default: module.InvestigationWorkspace })));
const key = 'opensearch-workbench-active-feature';
function FeatureWorkspace() {
  useLanguage();
  const [feature, setFeature] = useState<ActiveFeature>(() => {
    const saved = localStorage.getItem(key);
    return saved === 'dataprepper' || saved === 'ism' || saved === 'investigation' ? saved : 'notebook';
  });
  const select = (next: ActiveFeature) => { setFeature(next); try { localStorage.setItem(key, next); } catch { /* Navigation works without preference storage. */ } };
  return <ErrorBoundary key={feature}><Suspense fallback={<p role="status">{t('Opening workspace…')}</p>}>
    {feature === 'notebook' ? <Notebook onFeatureChange={select} /> : feature === 'dataprepper' ? <DataPrepper onFeatureChange={select} />
      : feature === 'ism' ? <ISM onFeatureChange={select} /> : <Investigation onFeatureChange={select} />}
  </Suspense></ErrorBoundary>;
}
export default function AppShell() {
  useLanguage();
  return <ErrorBoundary><ThemeProvider><AppProvider><FeatureWorkspace /></AppProvider></ThemeProvider></ErrorBoundary>;
}
