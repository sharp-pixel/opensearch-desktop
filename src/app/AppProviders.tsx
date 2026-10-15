// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ReactNode } from 'react';
import { WorkspaceLifecycle } from './WorkspaceLifecycle';
import { ConnectionProvider } from '../connections/ConnectionProvider';
import { NotebookProvider } from '../features/notebook/ui/NotebookContext';
import { InvestigationProvider } from '../features/investigation/ui/InvestigationContext';

/** Keep document stores alive across feature navigation; features own only their own providers. */
export function AppProvider({ children }: { children?: ReactNode }) {
  return <ConnectionProvider><NotebookProvider><InvestigationProvider><WorkspaceLifecycle>{children}</WorkspaceLifecycle></InvestigationProvider></NotebookProvider></ConnectionProvider>;
}
