// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Notebook interface for OpenSearch Notebook
 * Requirements: 1.1
 */

import type { Cell } from './cell';

export interface Notebook {
  id: string;
  name: string;
  cells: Cell[];
  createdAt: number;
  updatedAt: number;
  connectionId: string | null;
}

export interface NotebookMetadata {
  file?: NotebookFileBinding;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  cellCount: number;
}

/** Kept in recovery storage, never exported into the portable notebook file. */
export interface NotebookFileBinding {
  path: string | null;
  name: string;
  revision: string;
  dirty: boolean;
}
