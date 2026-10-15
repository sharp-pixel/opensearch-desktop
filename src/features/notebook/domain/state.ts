// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { convertCell } from './create';
import type { Notebook, NotebookMetadata } from '../../../types/notebook';
import type { Cell, CellType, QueryResult, PPLResult, GrpcResult } from '../../../types/cell';
import type { TrackedOperation, ApiTrackerState, CategorizedPermission } from '../../../types/tracking';
import { mapEndpointToPermission } from '../../../services/permissionMapper';

/**
 * Application Settings
 */
export interface AppSettings {
  theme: 'light' | 'dark';
  autoSaveInterval: number;
  defaultConnection: string | null;
  editorFontSize: number;
}

/**
 * UI State
 */
export interface UIState {
  sidebarOpen: boolean;
  selectedCellId: string | null;
  executingCellIds: Set<string>;
  rolePreviewOpen: boolean;
}

/**
 * Application State
 */
export interface AppState {
  notebooks: NotebookMetadata[];
  activeNotebook: Notebook | null;
  tracking: ApiTrackerState;
  settings: AppSettings;
  ui: UIState;
}

/**
 * Action Types
 */
export type AppAction =
  | { type: 'SET_ACTIVE_NOTEBOOK'; payload: Notebook | null }
  | { type: 'CONVERT_CELL'; payload: { cellId: string; type: CellType } }
  | { type: 'UPDATE_CELL'; payload: { cellId: string; updates: Partial<Cell> } }
  | { type: 'ADD_CELL'; payload: { cell: Cell; afterCellId?: string } }
  | { type: 'DELETE_CELL'; payload: string }
  | { type: 'REORDER_CELLS'; payload: string[] }
  | { type: 'SET_CELL_EXECUTING'; payload: { cellId: string; executing: boolean } }
  | { type: 'SET_QUERY_RESULT'; payload: { cellId: string; result: QueryResult } }
  | { type: 'SET_GRPC_RESULT'; payload: { cellId: string; result: GrpcResult } }
  | { type: 'SET_PPL_RESULT'; payload: { cellId: string; result: PPLResult } }
  | { type: 'TRACK_OPERATION'; payload: TrackedOperation }
  | { type: 'CLEAR_TRACKING' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_ROLE_PREVIEW_OPEN'; payload: boolean }
  | { type: 'SET_SELECTED_CELL'; payload: string | null }
  | { type: 'SET_NOTEBOOKS'; payload: NotebookMetadata[] }
  | { type: 'SET_TRACKING'; payload: ApiTrackerState }
  | { type: 'RENAME_NOTEBOOK'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_NOTEBOOK_CELLS'; payload: Cell[] };

/**
 * Default settings
 */
const defaultSettings: AppSettings = {
  theme: 'light',
  autoSaveInterval: 500,
  defaultConnection: null,
  editorFontSize: 14,
};

/**
 * Initial UI state
 */
const initialUIState: UIState = {
  sidebarOpen: true,
  selectedCellId: null,
  executingCellIds: new Set(),
  rolePreviewOpen: false,
};

/**
 * Initial application state
 */
export const initialState: AppState = {
  notebooks: [],
  activeNotebook: null,
  tracking: { operations: [], permissions: [] },
  settings: defaultSettings,
  ui: initialUIState,
};


/**
 * App Reducer - handles all state transitions
 * Requirements: 1.5, 2.4
 */
export function appReducer(state: AppState, action: AppAction, now: number): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_NOTEBOOK':
      return {
        ...state,
        activeNotebook: action.payload,
        ui: {
          ...state.ui,
          selectedCellId: action.payload?.cells[0]?.id ?? null,
        },
      };

    case 'CONVERT_CELL': {
      if (!state.activeNotebook) return state;
      return { ...state, activeNotebook: { ...state.activeNotebook, updatedAt: now,
        cells: state.activeNotebook.cells.map(cell => cell.id === action.payload.cellId ? convertCell(cell, action.payload.type, now) : cell) } };
    }
    case 'UPDATE_CELL': {
      if (!state.activeNotebook) return state;
      const { cellId, updates } = action.payload;
      const cellIndex = state.activeNotebook.cells.findIndex((c) => c.id === cellId);
      if (cellIndex < 0) return state;

      const updatedCells = [...state.activeNotebook.cells];
      updatedCells[cellIndex] = {
        ...updatedCells[cellIndex],
        ...updates,
        id: updatedCells[cellIndex]!.id,
        type: updatedCells[cellIndex]!.type,
        createdAt: updatedCells[cellIndex]!.createdAt,
        updatedAt: now,
      } as Cell;

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: updatedCells,
          updatedAt: now,
        },
      };
    }

    case 'ADD_CELL': {
      if (!state.activeNotebook) return state;
      const { cell, afterCellId } = action.payload;
      let newCells: Cell[];

      if (afterCellId === '__BEGINNING__') {
        // Insert at the very beginning
        newCells = [cell, ...state.activeNotebook.cells];
      } else if (afterCellId) {
        const afterIndex = state.activeNotebook.cells.findIndex((c) => c.id === afterCellId);
        if (afterIndex >= 0) {
          newCells = [
            ...state.activeNotebook.cells.slice(0, afterIndex + 1),
            cell,
            ...state.activeNotebook.cells.slice(afterIndex + 1),
          ];
        } else {
          newCells = [...state.activeNotebook.cells, cell];
        }
      } else {
        newCells = [...state.activeNotebook.cells, cell];
      }

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: newCells,
          updatedAt: now,
        },
        ui: {
          ...state.ui,
          selectedCellId: cell.id,
        },
      };
    }

    case 'DELETE_CELL': {
      if (!state.activeNotebook) return state;
      const cellId = action.payload;
      const newCells = state.activeNotebook.cells.filter((c) => c.id !== cellId);

      let newSelectedCellId = state.ui.selectedCellId;
      if (state.ui.selectedCellId === cellId) {
        const deletedIndex = state.activeNotebook.cells.findIndex((c) => c.id === cellId);
        if (deletedIndex > 0) {
          newSelectedCellId = state.activeNotebook.cells[deletedIndex - 1]?.id ?? null;
        } else if (newCells.length > 0) {
          newSelectedCellId = newCells[0]?.id ?? null;
        } else {
          newSelectedCellId = null;
        }
      }

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: newCells,
          updatedAt: now,
        },
        ui: {
          ...state.ui,
          selectedCellId: newSelectedCellId,
        },
      };
    }

    case 'REORDER_CELLS': {
      if (!state.activeNotebook) return state;
      const cellIds = action.payload;
      const cellMap = new Map(state.activeNotebook.cells.map((c) => [c.id, c]));
      const reorderedCells = cellIds
        .map((id) => cellMap.get(id))
        .filter((c): c is Cell => c !== undefined);

      if (new Set(cellIds).size !== cellIds.length || reorderedCells.length !== state.activeNotebook.cells.length) {
        return state;
      }

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: reorderedCells,
          updatedAt: now,
        },
      };
    }

    case 'SET_CELL_EXECUTING': {
      const { cellId, executing } = action.payload;
      const newExecutingCellIds = new Set(state.ui.executingCellIds);
      if (executing) {
        newExecutingCellIds.add(cellId);
      } else {
        newExecutingCellIds.delete(cellId);
      }

      return {
        ...state,
        ui: {
          ...state.ui,
          executingCellIds: newExecutingCellIds,
        },
      };
    }

    case 'SET_QUERY_RESULT': {
      if (!state.activeNotebook) return state;
      const { cellId, result } = action.payload;
      const cellIndex = state.activeNotebook.cells.findIndex((c) => c.id === cellId);
      if (cellIndex < 0) return state;

      const cell = state.activeNotebook.cells[cellIndex];
      if (cell?.type !== 'query') return state;

      const updatedCells = [...state.activeNotebook.cells];
      updatedCells[cellIndex] = {
        ...cell,
        lastResult: result,
        updatedAt: now,
      };

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: updatedCells,
          updatedAt: now,
        },
      };
    }

    case 'SET_GRPC_RESULT': {
      if (!state.activeNotebook) return state;
      const { cellId, result } = action.payload;
      const cellIndex = state.activeNotebook.cells.findIndex((c) => c.id === cellId);
      if (cellIndex < 0) return state;

      const cell = state.activeNotebook.cells[cellIndex];
      if (cell?.type !== 'grpc') return state;

      const updatedCells = [...state.activeNotebook.cells];
      updatedCells[cellIndex] = {
        ...cell,
        lastResult: result,
        updatedAt: now,
      };

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: updatedCells,
          updatedAt: now,
        },
      };
    }

    case 'SET_PPL_RESULT': {
      if (!state.activeNotebook) return state;
      const { cellId, result } = action.payload;
      const cellIndex = state.activeNotebook.cells.findIndex((c) => c.id === cellId);
      if (cellIndex < 0) return state;

      const cell = state.activeNotebook.cells[cellIndex];
      if (cell?.type !== 'ppl') return state;

      const updatedCells = [...state.activeNotebook.cells];
      updatedCells[cellIndex] = {
        ...cell,
        lastResult: result,
        updatedAt: now,
      };

      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: updatedCells,
          updatedAt: now,
        },
      };
    }

    case 'TRACK_OPERATION': {
      const operation = action.payload;

      // Check for duplicate - same method, endpoint, AND index patterns
      const isDuplicate = state.tracking.operations.some(
        (op) =>
          op.method === operation.method &&
          op.transport === operation.transport &&
          op.endpoint === operation.endpoint &&
          JSON.stringify([...op.indexPatterns].sort()) === JSON.stringify([...operation.indexPatterns].sort())
      );

      if (isDuplicate) return state;

      // Derive permission from the operation
      const permissionMapping = mapEndpointToPermission(operation.method, operation.endpoint);
      const newPermissions = [...state.tracking.permissions];

      if (permissionMapping) {
        const derivedPermissions = permissionMapping.permissions.map((perm) => {
          if (perm.type === 'index' && operation.indexPatterns.length > 0) {
            return {
              ...perm,
              indexPatterns: operation.indexPatterns,
            };
          }
          return perm;
        });

        for (const newPermission of derivedPermissions) {
          const existingPermission = newPermissions.find(
            (p) =>
              p.type === newPermission.type &&
              p.permission === newPermission.permission &&
              JSON.stringify(p.indexPatterns) === JSON.stringify(newPermission.indexPatterns)
          );

          if (!existingPermission) {
            newPermissions.push(newPermission);
          }
        }

        // For PPL and SQL queries, also add index read permission if index patterns are present
        // These query languages require both cluster permission and index read access
        const isPPLorSQL = operation.endpoint === '/_plugins/_ppl' || operation.endpoint === '/_plugins/_sql';
        if (isPPLorSQL && operation.indexPatterns.length > 0) {
          const indexReadPermission: CategorizedPermission = {
            type: 'index',
            permission: 'indices:data/read/search',
            indexPatterns: operation.indexPatterns,
          };

          const existingIndexPermission = newPermissions.find(
            (p) =>
              p.type === 'index' &&
              p.permission === 'indices:data/read/search' &&
              JSON.stringify(p.indexPatterns) === JSON.stringify(operation.indexPatterns)
          );

          if (!existingIndexPermission) {
            newPermissions.push(indexReadPermission);
          }
        }
      }

      return {
        ...state,
        tracking: {
          ...state.tracking,
          operations: [...state.tracking.operations, operation],
          permissions: newPermissions,
        },
      };
    }

    case 'CLEAR_TRACKING':
      return {
        ...state,
        tracking: { operations: [], permissions: [] },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: {
          ...state.ui,
          sidebarOpen: !state.ui.sidebarOpen,
        },
      };

    case 'SET_ROLE_PREVIEW_OPEN':
      return {
        ...state,
        ui: {
          ...state.ui,
          rolePreviewOpen: action.payload,
        },
      };

    case 'SET_SELECTED_CELL':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedCellId: action.payload,
        },
      };

    case 'SET_NOTEBOOKS':
      return {
        ...state,
        notebooks: action.payload,
      };

    case 'SET_TRACKING':
      return {
        ...state,
        tracking: action.payload,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case 'SET_NOTEBOOK_CELLS': {
      if (!state.activeNotebook) return state;
      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          cells: action.payload,
          updatedAt: now,
        },
      };
    }

    case 'RENAME_NOTEBOOK': {
      if (!state.activeNotebook) return state;
      const newName = action.payload;
      return {
        ...state,
        activeNotebook: {
          ...state.activeNotebook,
          name: newName,
          updatedAt: now,
        },
        notebooks: state.notebooks.map((nb) =>
          nb.id === state.activeNotebook?.id
            ? { ...nb, name: newName, updatedAt: now }
            : nb
        ),
      };
    }

    default:
      return state;
  }
}
