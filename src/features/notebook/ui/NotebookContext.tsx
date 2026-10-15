// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, useMemo, type ReactNode } from 'react';
import { createNotebookStore, type NotebookStore, type NotebookSnapshot } from '../state/store';
import type { AppSettings } from '../domain/state';
import type { Cell, CellType, QueryResult, PPLResult, GrpcResult } from '../../../types/cell';
import type { ApiTrackerState, TrackedOperation } from '../../../types/tracking';
export type { AppSettings, AppState, AppAction, UIState } from '../domain/state';

const NotebookContext = createContext<NotebookStore | null>(null);
export function NotebookProvider({ children }: { children?: ReactNode }) {
  const [store] = useState(createNotebookStore);
  useEffect(() => {
    store.resume();
    const flush = () => store.flush();
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); store.dispose(); };
  }, [store]);
  return <NotebookContext.Provider value={store}>{children}</NotebookContext.Provider>;
}
export function useNotebookStore() {
  const store = useContext(NotebookContext);
  if (!store) throw new Error('NotebookProvider is required');
  return store;
}
export function useNotebookSelector<T>(selector: (state: NotebookSnapshot) => T): T {
  const store = useNotebookStore();
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()));
}
export function useNotebook() {
  const store = useNotebookStore();
  const state = useNotebookSelector(snapshot => snapshot);
  const commands = useMemo(() => ({
    setActiveNotebook: store.select,
    openNotebookFile: store.openFile,
    saveNotebookFile: store.saveFile,
    forgetRecentFile: store.forgetRecentFile,
    dismissFileError: store.dismissFileError,
    createNewNotebook: store.create,
    deleteNotebook: store.remove,
    addCell: (type: CellType, afterCellId?: string) => store.addCell(type, afterCellId),
    renameNotebook: (name: string) => store.dispatch({ type: 'RENAME_NOTEBOOK', payload: name }),
    updateCell: (cellId: string, updates: Partial<Cell>) => store.dispatch({ type: 'UPDATE_CELL', payload: { cellId, updates } }),
    convertCell: (cellId: string, type: CellType) => store.dispatch({ type: 'CONVERT_CELL', payload: { cellId, type } }),
    deleteCell: (cellId: string) => store.dispatch({ type: 'DELETE_CELL', payload: cellId }),
    reorderCells: (ids: string[]) => store.dispatch({ type: 'REORDER_CELLS', payload: ids }),
    selectCell: (id: string | null) => store.dispatch({ type: 'SET_SELECTED_CELL', payload: id }),
    setCells: (cells: Cell[]) => store.dispatch({ type: 'SET_NOTEBOOK_CELLS', payload: cells }),
    setQueryResult: (cellId: string, result: QueryResult, documentId?: string) => store.dispatch({ type: 'SET_QUERY_RESULT', payload: { cellId, result } }, documentId),
    setPPLResult: (cellId: string, result: PPLResult, documentId?: string) => store.dispatch({ type: 'SET_PPL_RESULT', payload: { cellId, result } }, documentId),
    setGrpcResult: (cellId: string, result: GrpcResult, documentId?: string) => store.dispatch({ type: 'SET_GRPC_RESULT', payload: { cellId, result } }, documentId),
    setCellExecuting: (cellId: string, executing: boolean, documentId?: string) => store.dispatch({ type: 'SET_CELL_EXECUTING', payload: { cellId, executing } }, documentId),
  }), [store]);
  return { ...commands, notebooks: state.notebooks, activeNotebook: state.activeNotebook,
    activeFile: state.notebooks.find(item => item.id === state.activeNotebook?.id)?.file,
    recentFiles: state.recentFiles, fileBusy: state.fileBusy, fileError: state.fileError,
    selectedCellId: state.ui.selectedCellId, executingCellIds: state.ui.executingCellIds,
    saveState: state.saveState, saveError: state.saveError, retrySave: store.flush,
    loadingNotebookId: state.loadingNotebookId, loadError: state.loadError, retryLoad: store.retryLoad };
}
export function useTracking() {
  const store = useNotebookStore();
  const tracking = useNotebookSelector(state => state.tracking);
  const commands = useMemo(() => ({
    trackOperation: (operation: TrackedOperation, documentId?: string) => store.dispatch({ type: 'TRACK_OPERATION', payload: operation }, documentId),
    clearTracking: () => store.dispatch({ type: 'CLEAR_TRACKING' }),
    setTracking: (value: ApiTrackerState) => store.dispatch({ type: 'SET_TRACKING', payload: value }),
  }), [store]);
  return { ...commands, tracking, operations: tracking.operations, permissions: tracking.permissions };
}
export function useUI() {
  const store = useNotebookStore();
  const ui = useNotebookSelector(state => state.ui);
  const commands = useMemo(() => ({
    toggleSidebar: () => store.dispatch({ type: 'TOGGLE_SIDEBAR' }),
    setRolePreviewOpen: (open: boolean) => store.dispatch({ type: 'SET_ROLE_PREVIEW_OPEN', payload: open }),
  }), [store]);
  return { ...ui, ...commands };
}
export function useSettings() {
  const store = useNotebookStore();
  const settings = useNotebookSelector(state => state.settings);
  const updateSettings = useMemo(() => (updates: Partial<AppSettings>) => store.dispatch({ type: 'UPDATE_SETTINGS', payload: updates }), [store]);
  return { settings, updateSettings };
}
