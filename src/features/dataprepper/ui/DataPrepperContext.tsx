// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Data Prepper Workbench Context
 * State management for the Data Prepper configuration editor and simulator
 */

/* eslint-disable react-refresh/only-export-components */

import { pipelineFileSettings } from '../../../services/featureFileSettings';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  SourceFormat,
  ProcessingResult,
  WorkbenchState,
  ValidationError,
} from '../../../types/dataPrepper';
import type { GeneratedRole } from '../../../types/role';
import { importPipelineDocument } from '../domain/document';
import { evaluatePipeline } from '../application/evaluate';
import { createRunCoordinator } from '../../../execution/runs';
import { validatePipeline } from '../../../services/pipelineParser';
import { validateSourceData } from '../../../services/sourceDataParser';
import { generateDataPrepperRole, isRoleError } from '../../../services/dataPrepperRoleGenerator';

import { useFeatureFileWorkspace } from '../../../storage/useFeatureFileWorkspace';
import type { FeatureFileWorkspace } from '../../../storage/featureFileWorkspace';
import type { PipelineDocument } from '../domain/document';
import type { SaveState } from '../../../storage/saveCoordinator';

/** Default pipeline template */
const DEFAULT_PIPELINE = `log-pipeline:
  processor:
    - add_entries:
        entries:
          - key: processed_at
            value: "\${@timestamp}"
  sink:
    - opensearch:
        index: logs-%{yyyy.MM.dd}
        hosts:
          - https://localhost:9200
`;

/** Default source data */
const DEFAULT_SOURCE = `{
  "message": "Hello, Data Prepper!",
  "level": "INFO",
  "@timestamp": "2024-01-15T10:30:00Z"
}`;

interface DataPrepperContextValue {
  files: FeatureFileWorkspace<PipelineDocument>;
  fileState: ReturnType<FeatureFileWorkspace<PipelineDocument>['getSnapshot']>;
  saveState: SaveState;
  saveError: string | null;
  retrySave: () => Promise<boolean>;
  // State
  sourceData: string;
  sourceFormat: SourceFormat;
  pipelineConfig: string;
  processingResult: ProcessingResult | null;
  isProcessing: boolean;
  sourceErrors: ValidationError[];
  pipelineErrors: ValidationError[];
  generatedRole: GeneratedRole | null;
  roleError: string | null;

  // Actions
  setSourceData: (data: string) => void;
  setSourceFormat: (format: SourceFormat) => void;
  setPipelineConfig: (config: string) => void;
  evaluate: () => Promise<void>;
  cancelEvaluation: () => void;
  generateRole: () => void;
  clearOutput: () => void;
  exportState: () => string;
  importState: (json: string) => boolean;
  loadTemplate: (template: 'logs' | 'metrics' | 'traces') => void;
}

const DataPrepperContext = createContext<DataPrepperContextValue | null>(null);

/**
 * Data Prepper Provider component
 */
export function DataPrepperProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const empty: PipelineDocument = { sourceData: DEFAULT_SOURCE, sourceFormat: 'json', pipelineConfig: DEFAULT_PIPELINE };
  const draft = useFeatureFileWorkspace(pipelineFileSettings(empty));
  const { update: updateDraft } = draft;
  const { sourceData, sourceFormat, pipelineConfig } = draft.value;
  const setSourceDataState = useCallback((sourceData: string) => updateDraft({ sourceData }), [updateDraft]);
  const setSourceFormatState = useCallback((sourceFormat: SourceFormat) => updateDraft({ sourceFormat }), [updateDraft]);
  const setPipelineConfigState = useCallback((pipelineConfig: string) => updateDraft({ pipelineConfig }), [updateDraft]);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<ValidationError[]>([]);
  const [pipelineErrors, setPipelineErrors] = useState<ValidationError[]>([]);
  const [generatedRole, setGeneratedRole] = useState<GeneratedRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [runs] = useState(createRunCoordinator);
  useEffect(() => {
    setIsProcessing(false);
    setProcessingResult(null); setGeneratedRole(null); setRoleError(null);
    return () => runs.cancelDocument('pipeline-draft');
  }, [runs, sourceData, sourceFormat, pipelineConfig, draft.fileState.active?.id]);

  // Validate source data when it changes
  useEffect(() => {
    const result = validateSourceData(sourceData, sourceFormat);
    setSourceErrors(result.errors);
  }, [sourceData, sourceFormat]);

  // Validate pipeline config when it changes
  useEffect(() => {
    const result = validatePipeline(pipelineConfig);
    setPipelineErrors(result.errors);
  }, [pipelineConfig]);

  const setSourceData = useCallback((data: string) => {
    setSourceDataState(data);
    setProcessingResult(null);
  }, [setSourceDataState]);

  const setSourceFormat = useCallback((format: SourceFormat) => {
    setSourceFormatState(format);
    setProcessingResult(null);
  }, [setSourceFormatState]);

  const setPipelineConfig = useCallback((config: string) => {
    setPipelineConfigState(config);
    setProcessingResult(null);
    setGeneratedRole(null);
    setRoleError(null);
  }, [setPipelineConfigState]);

  const evaluate = useCallback(async () => {
    const run = runs.begin({ feature: 'dataprepper', documentId: 'pipeline-draft', cellId: 'pipeline', connectionId: 'simulation', inputRevision: Date.now() });
    setIsProcessing(true);
    setProcessingResult(null);
    try {
      const result = await evaluatePipeline(sourceData, sourceFormat, pipelineConfig, run.signal);
      if (run.isCurrent()) setProcessingResult(result);
    } catch (error) {
      if (!run.isCurrent()) return;
      setProcessingResult({
        success: false,
        events: [],
        errors: [{
          eventIndex: -1,
          processor: 'executor',
          message: error instanceof Error ? error.message : 'Unknown error',
        }],
        stats: {
          totalEvents: 0,
          successfulEvents: 0,
          failedEvents: 0,
          processingTimeMs: 0,
        },
        warnings: [],
      });
    } finally {
      if (run.isCurrent()) setIsProcessing(false);
      run.finish();
    }
  }, [runs, sourceData, sourceFormat, pipelineConfig]);

  const cancelEvaluation = useCallback(() => {
    runs.cancelDocument('pipeline-draft');
    setIsProcessing(false);
  }, [runs]);

  const generateRole = useCallback(() => {
    setRoleError(null);
    setGeneratedRole(null);

    const result = generateDataPrepperRole(pipelineConfig, 'data_prepper_pipeline_role');
    
    if (isRoleError(result)) {
      setRoleError(result.error);
    } else {
      setGeneratedRole(result);
    }
  }, [pipelineConfig]);

  const clearOutput = useCallback(() => {
    runs.cancelDocument('pipeline-draft'); setIsProcessing(false);
    setProcessingResult(null);
    setGeneratedRole(null);
    setRoleError(null);
  }, [runs]);

  const exportState = useCallback((): string => {
    const state: WorkbenchState = {
      sourceData,
      sourceFormat,
      pipelineConfig,
      timestamp: Date.now(),
    };
    return JSON.stringify(state, null, 2);
  }, [sourceData, sourceFormat, pipelineConfig]);

  const importState = useCallback((json: string): boolean => {
    try {
      const document = importPipelineDocument(json, { sourceData, sourceFormat, pipelineConfig });
      updateDraft(document);
      runs.cancelDocument('pipeline-draft');
      setIsProcessing(false);
      setProcessingResult(null);
      setGeneratedRole(null);
      setRoleError(null);
      return true;
    } catch {
      return false;
    }
  }, [sourceData, sourceFormat, pipelineConfig, updateDraft, runs]);

  const loadTemplate = useCallback((template: 'logs' | 'metrics' | 'traces') => {
    switch (template) {
      case 'logs':
        setSourceDataState(`{
  "message": "192.168.1.1 - - [15/Jan/2024:10:30:00 +0000] \\"GET /api/users HTTP/1.1\\" 200 1234",
  "source": "nginx",
  "level": "INFO"
}`);
        setPipelineConfigState(`log-pipeline:
  processor:
    - grok:
        match:
          message:
            - "%{COMMONAPACHELOG}"
    - date:
        match:
          - key: timestamp
            patterns:
              - "dd/MMM/yyyy:HH:mm:ss Z"
        destination: "@timestamp"
  sink:
    - opensearch:
        index: logs-%{yyyy.MM.dd}
        hosts:
          - https://localhost:9200
`);
        break;
      case 'metrics':
        setSourceDataState(`{
  "name": "cpu_usage",
  "value": 75.5,
  "host": "server-01",
  "timestamp": "2024-01-15T10:30:00Z"
}`);
        setPipelineConfigState(`metrics-pipeline:
  processor:
    - add_entries:
        entries:
          - key: metric_type
            value: gauge
    - rename_keys:
        entries:
          - from_key: name
            to_key: metric_name
  sink:
    - opensearch:
        index: metrics
        hosts:
          - https://localhost:9200
`);
        break;
      case 'traces':
        setSourceDataState(`{
  "traceId": "abc123",
  "spanId": "span456",
  "operationName": "HTTP GET /api/users",
  "duration": 150,
  "status": "OK"
}`);
        setPipelineConfigState(`trace-pipeline:
  processor:
    - add_entries:
        entries:
          - key: service.name
            value: my-service
    - copy_values:
        entries:
          - from_key: traceId
            to_key: trace.id
          - from_key: spanId
            to_key: span.id
  sink:
    - opensearch:
        index: traces
        hosts:
          - https://localhost:9200
`);
        break;
    }
    setSourceFormatState('json');
    setProcessingResult(null);
    setGeneratedRole(null);
    setRoleError(null);
  }, [setSourceDataState, setSourceFormatState, setPipelineConfigState]);

  const value: DataPrepperContextValue = {
    files: draft.files, fileState: draft.fileState,
    saveState: draft.saveState, saveError: draft.saveError, retrySave: draft.retrySave,
    sourceData,
    sourceFormat,
    pipelineConfig,
    processingResult,
    isProcessing,
    sourceErrors,
    pipelineErrors,
    generatedRole,
    roleError,
    setSourceData,
    setSourceFormat,
    setPipelineConfig,
    evaluate,
    cancelEvaluation,
    generateRole,
    clearOutput,
    exportState,
    importState,
    loadTemplate,
  };

  return (
    <DataPrepperContext.Provider value={value}>
      {children}
    </DataPrepperContext.Provider>
  );
}

/**
 * Hook to use Data Prepper context
 */
export function useDataPrepper(): DataPrepperContextValue {
  const context = useContext(DataPrepperContext);
  if (!context) {
    throw new Error('useDataPrepper must be used within a DataPrepperProvider');
  }
  return context;
}
