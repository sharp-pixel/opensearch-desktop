// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Policy Analyzer Context
 * State management for the ISM policy editor, visualization, and analysis
 */

/* eslint-disable react-refresh/only-export-components */

import { policyFileSettings } from '../../../services/featureFileSettings';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  ISMPolicy,
  ValidationError,
  AnalysisResult,
  DiagramData,
  TimelineData,
  SimulationParams,
  AnalyzerTab,
  SavedPolicy,
  LayoutPreferences,
} from '../../../types/ism';

import { analyzePolicyDraft } from '../application/analyze';
import { useFeatureFileWorkspace } from '../../../storage/useFeatureFileWorkspace';
import type { FeatureFileWorkspace } from '../../../storage/featureFileWorkspace';
import { useDraft } from '../../../storage/useDraft';
import type { PolicyDraft } from '../../../storage/drafts';
import type { SaveState } from '../../../storage/saveCoordinator';
const LAYOUT_KEY = 'ism-analyzer-layout';

/** Default hot-warm-cold policy template */
const DEFAULT_POLICY = `{
  "policy": {
    "description": "Hot-warm-cold lifecycle policy",
    "default_state": "hot",
    "states": [
      {
        "name": "hot",
        "actions": [
          { "rollover": { "min_index_age": "1d" } }
        ],
        "transitions": [
          { "state_name": "warm", "conditions": { "min_index_age": "2d" } }
        ]
      },
      {
        "name": "warm",
        "actions": [
          { "replica_count": { "number_of_replicas": 1 } }
        ],
        "transitions": [
          { "state_name": "cold", "conditions": { "min_index_age": "30d" } }
        ]
      },
      {
        "name": "cold",
        "actions": [
          { "read_only": {} }
        ],
        "transitions": [
          { "state_name": "delete", "conditions": { "min_index_age": "90d" } }
        ]
      },
      {
        "name": "delete",
        "actions": [
          { "delete": {} }
        ]
      }
    ]
  }
}`;

/** Default simulation parameters */
const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  creationDate: new Date(),
  initialSize: 1024 * 1024 * 100, // 100 MB
  sizeGrowthRate: 1024 * 1024 * 10, // 10 MB per day
  initialDocCount: 10000,
  docGrowthRate: 1000, // 1000 docs per day
  simulationDays: 120,
};

/** Default layout preferences */
const DEFAULT_LAYOUT: LayoutPreferences = {
  editorWidth: 50,
  rightPanelWidth: 50,
};

interface ISMAnalyzerContextValue {
  files: FeatureFileWorkspace<string>;
  fileState: ReturnType<FeatureFileWorkspace<string>['getSnapshot']>;
  saveState: SaveState;
  saveError: string | null;
  retrySave: () => Promise<boolean>;
  // State
  policyJson: string;
  parsedPolicy: ISMPolicy | null;
  validationErrors: ValidationError[];
  analysisResults: AnalysisResult[];
  diagramData: DiagramData | null;
  timelineData: TimelineData | null;
  simulationParams: SimulationParams;
  activeTab: AnalyzerTab;
  selectedState: string | null;
  recentPolicies: SavedPolicy[];
  layoutPreferences: LayoutPreferences;

  // Actions
  setPolicyJson: (json: string) => void;
  setActiveTab: (tab: AnalyzerTab) => void;
  setSelectedState: (state: string | null) => void;
  setSimulationParams: (params: SimulationParams) => void;
  loadTemplate: (template: 'hot-warm-cold' | 'rollover-delete' | 'snapshot') => void;
  exportPolicy: () => void;
  importPolicy: (file: File) => Promise<void>;
  copyToClipboard: () => Promise<void>;
  loadRecentPolicy: (id: string) => void;
  setLayoutPreferences: (prefs: LayoutPreferences) => void;
  testIndexPattern: (pattern: string, indexName: string) => boolean;
  setValidationErrors: (errors: ValidationError[]) => void;
  setAnalysisResults: (results: AnalysisResult[]) => void;
  setDiagramData: (data: DiagramData | null) => void;
  setTimelineData: (data: TimelineData | null) => void;
  setParsedPolicy: (policy: ISMPolicy | null) => void;
}

const ISMAnalyzerContext = createContext<ISMAnalyzerContextValue | null>(null);

function readSavedValue(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function loadInitialLayout(): LayoutPreferences {
  const saved = readSavedValue(LAYOUT_KEY);
  if (saved && typeof saved === 'object' && 'editorWidth' in saved && 'rightPanelWidth' in saved &&
      typeof saved.editorWidth === 'number' && typeof saved.rightPanelWidth === 'number') {
    return { editorWidth: saved.editorWidth, rightPanelWidth: saved.rightPanelWidth };
  }
  return DEFAULT_LAYOUT;
}

/**
 * ISM Analyzer Provider component
 */
export function ISMAnalyzerProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const draft = useDraft<{ id: 'ism'; content: PolicyDraft }>({ id: 'ism', content: { policyJson: DEFAULT_POLICY, recentPolicies: [] } });
  const { update: updateDraft } = draft;
  const fileDraft = useFeatureFileWorkspace(policyFileSettings(DEFAULT_POLICY));
  const policyJson = fileDraft.value;
  const updateFileDraft = fileDraft.update;
  const { recentPolicies } = draft.value;
  const setPolicyJsonState = useCallback((policyJson: string) => updateFileDraft(() => policyJson), [updateFileDraft]);
  const [parsedPolicy, setParsedPolicyState] = useState<ISMPolicy | null>(null);
  const [validationErrors, setValidationErrorsState] = useState<ValidationError[]>([]);
  const [analysisResults, setAnalysisResultsState] = useState<AnalysisResult[]>([]);
  const [diagramData, setDiagramDataState] = useState<DiagramData | null>(null);
  const [timelineData, setTimelineDataState] = useState<TimelineData | null>(null);
  const [simulationParams, setSimulationParamsState] = useState<SimulationParams>(DEFAULT_SIMULATION_PARAMS);
  const [activeTab, setActiveTabState] = useState<AnalyzerTab>('diagram');
  const [selectedState, setSelectedStateState] = useState<string | null>(null);

  const [layoutPreferences, setLayoutPreferencesState] = useState<LayoutPreferences>(loadInitialLayout);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = analyzePolicyDraft(policyJson, simulationParams);
      setParsedPolicyState(result.parsedPolicy); setValidationErrorsState(result.validationErrors);
      setDiagramDataState(result.diagramData); setAnalysisResultsState(result.analysisResults);
      setTimelineDataState(result.timelineData);
    }, 150);
    return () => clearTimeout(timer);
  }, [policyJson, simulationParams]);

  // Save layout preferences on changes
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutPreferences));
    } catch {
      // Ignore storage errors
    }
  }, [layoutPreferences]);

  const setPolicyJson = useCallback((json: string) => {
    setPolicyJsonState(json);
  }, [setPolicyJsonState]);

  const setActiveTab = useCallback((tab: AnalyzerTab) => {
    setActiveTabState(tab);
  }, []);

  const setSelectedState = useCallback((state: string | null) => {
    setSelectedStateState(state);
  }, []);

  const setSimulationParams = useCallback((params: SimulationParams) => {
    setSimulationParamsState(params);
  }, []);

  const setValidationErrors = useCallback((errors: ValidationError[]) => {
    setValidationErrorsState(errors);
  }, []);

  const setAnalysisResults = useCallback((results: AnalysisResult[]) => {
    setAnalysisResultsState(results);
  }, []);

  const setDiagramData = useCallback((data: DiagramData | null) => {
    setDiagramDataState(data);
  }, []);

  const setTimelineData = useCallback((data: TimelineData | null) => {
    setTimelineDataState(data);
  }, []);

  const setParsedPolicy = useCallback((policy: ISMPolicy | null) => {
    setParsedPolicyState(policy);
  }, []);

  const setLayoutPreferences = useCallback((prefs: LayoutPreferences) => {
    setLayoutPreferencesState(prefs);
  }, []);

  const loadTemplate = useCallback((template: 'hot-warm-cold' | 'rollover-delete' | 'snapshot') => {
    switch (template) {
      case 'hot-warm-cold':
        setPolicyJsonState(DEFAULT_POLICY);
        break;
      case 'rollover-delete':
        setPolicyJsonState(`{
  "policy": {
    "description": "Simple rollover and delete policy",
    "default_state": "rollover",
    "states": [
      {
        "name": "rollover",
        "actions": [
          { "rollover": { "min_size": "50gb" } }
        ],
        "transitions": [
          { "state_name": "delete", "conditions": { "min_index_age": "30d" } }
        ]
      },
      {
        "name": "delete",
        "actions": [
          { "delete": {} }
        ]
      }
    ]
  }
}`);
        break;
      case 'snapshot':
        setPolicyJsonState(`{
  "policy": {
    "description": "Snapshot before delete policy",
    "default_state": "active",
    "states": [
      {
        "name": "active",
        "transitions": [
          { "state_name": "snapshot", "conditions": { "min_index_age": "7d" } }
        ]
      },
      {
        "name": "snapshot",
        "actions": [
          { "snapshot": { "repository": "my-repo", "snapshot": "{{ctx.index}}" } }
        ],
        "transitions": [
          { "state_name": "delete", "conditions": { "min_index_age": "1d" } }
        ]
      },
      {
        "name": "delete",
        "actions": [
          { "delete": {} }
        ]
      }
    ]
  }
}`);
        break;
    }
  }, [setPolicyJsonState]);

  const exportPolicy = useCallback(() => {
    const blob = new Blob([policyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ism-policy.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [policyJson]);

  const importPolicy = useCallback(async (file: File): Promise<void> => {
    const text = await file.text();
    // Basic JSON validation
    JSON.parse(text); // Will throw if invalid
    setPolicyJsonState(text);
    
    // Add to recent policies
    const newPolicy: SavedPolicy = {
      id: `policy-${Date.now()}`,
      name: file.name.replace('.json', ''),
      policy: text,
      timestamp: Date.now(),
    };
    updateDraft(previous => ({ ...previous, recentPolicies: [newPolicy, ...previous.recentPolicies.filter(p => p.policy !== text)].slice(0, 10) }));
  }, [updateDraft, setPolicyJsonState]);

  const copyToClipboard = useCallback(async (): Promise<void> => {
    await navigator.clipboard.writeText(policyJson);
  }, [policyJson]);

  const loadRecentPolicy = useCallback((id: string) => {
    const policy = recentPolicies.find(p => p.id === id);
    if (policy) {
      setPolicyJsonState(policy.policy);
    }
  }, [recentPolicies, setPolicyJsonState]);

  const testIndexPattern = useCallback((pattern: string, indexName: string): boolean => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(indexName);
  }, []);

  const value: ISMAnalyzerContextValue = {
    files: fileDraft.files, fileState: fileDraft.fileState,
    saveState: draft.saveState, saveError: draft.saveError, retrySave: draft.retrySave,
    policyJson,
    parsedPolicy,
    validationErrors,
    analysisResults,
    diagramData,
    timelineData,
    simulationParams,
    activeTab,
    selectedState,
    recentPolicies,
    layoutPreferences,
    setPolicyJson,
    setActiveTab,
    setSelectedState,
    setSimulationParams,
    loadTemplate,
    exportPolicy,
    importPolicy,
    copyToClipboard,
    loadRecentPolicy,
    setLayoutPreferences,
    testIndexPattern,
    setValidationErrors,
    setAnalysisResults,
    setDiagramData,
    setTimelineData,
    setParsedPolicy,
  };

  return (
    <ISMAnalyzerContext.Provider value={value}>
      {children}
    </ISMAnalyzerContext.Provider>
  );
}

/**
 * Hook to use ISM Analyzer context
 */
export function useISMAnalyzer(): ISMAnalyzerContextValue {
  const context = useContext(ISMAnalyzerContext);
  if (!context) {
    throw new Error('useISMAnalyzer must be used within an ISMAnalyzerProvider');
  }
  return context;
}
