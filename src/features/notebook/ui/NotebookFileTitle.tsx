// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useNotebook } from './NotebookContext';
import { RenameDocumentTitle } from '../../../components/Files/RenameDocumentTitle';

export function NotebookFileTitle() {
  const { activeNotebook, activeFile, renameNotebook, fileBusy } = useNotebook();
  if (!activeNotebook) return null;
  return <RenameDocumentTitle document={{ ...activeNotebook, file: activeFile ?? undefined }} kind="notebook" busy={fileBusy} onRename={renameNotebook} />;
}
