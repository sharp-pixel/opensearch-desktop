// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../i18n';
import { lazy, memo, Suspense, useId } from 'react';
import type { EditorProps } from '@monaco-editor/react';
const MonacoEditor = lazy(() => import('./LocalMonaco'));
import { useTheme } from '../context/ThemeContext';

type Props = Omit<EditorProps, 'path' | 'defaultPath' | 'theme' | 'keepCurrentModel' | 'saveViewState'>;

/** Each mounted editor owns its model; switching documents remounts their editor list. */
export const WorkbenchEditor = memo(function WorkbenchEditor(props: Props) {
  useLanguage();
  const id = useId();
  const { theme } = useTheme();
  return <Suspense fallback={<div role="status">{t('Opening editor…')}</div>}><MonacoEditor {...props} path={`workbench://editor/${encodeURIComponent(id)}`}
    theme={theme.monacoTheme} keepCurrentModel={false} saveViewState={false} /></Suspense>;
});
