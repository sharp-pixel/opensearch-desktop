// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Type definitions for ISM Policy Analyzer
 * OpenSearch Index State Management (ISM) policy types
 */

// ============================================================================
// Core ISM Policy Types
// ============================================================================

/** Complete ISM policy structure */
export interface ISMPolicy {
  policy: {
    policy_id?: string;
    description?: string;
    default_state: string;
    states: ISMState[];
    ism_template?: ISMTemplate[];
  };
}

/** Single state in an ISM policy */
export interface ISMState {
  name: string;
  actions?: ISMAction[];
  transitions?: ISMTransition[];
}

/** Action configuration within a state */
export interface ISMAction {
  timeout?: string;
  retry?: RetryConfig;
  rollover?: RolloverAction;
  delete?: DeleteAction;
  read_only?: Record<string, never>;
  read_write?: Record<string, never>;
  replica_count?: ReplicaCountAction;
  force_merge?: ForceMergeAction;
  shrink?: ShrinkAction;
  snapshot?: SnapshotAction;
  close?: CloseAction;
  open?: OpenAction;
  convert_index_to_remote?: ConvertIndexToRemoteAction;
  rollup?: RollupAction;
  stop_replication?: StopReplicationAction;
  index_priority?: IndexPriorityAction;
  allocation?: AllocationAction;
  notification?: NotificationAction;
  warm_migration?: WarmMigrationAction;
  cold_migration?: ColdMigrationAction;
  cold_delete?: ColdDeleteAction;
}

/** Transition to another state */
export interface ISMTransition {
  state_name: string;
  conditions?: TransitionConditions;
}

/** Conditions that trigger a state transition */
export interface TransitionConditions {
  min_index_age?: string;
  min_doc_count?: number;
  min_size?: string;
  min_rollover_age?: string;
  min_state_age?: string;
  no_alias?: boolean;
  cron?: CronCondition;
}

/** Cron-based transition condition */
export interface CronCondition {
  cron: {
    expression: string;
    timezone: string;
  };
}

/** ISM template for automatic policy attachment */
export interface ISMTemplate {
  index_patterns: string[];
  priority?: number;
}

// ============================================================================
// Action Type Definitions
// ============================================================================

/** Rollover action configuration */
export interface RolloverAction {
  min_size?: string;
  min_doc_count?: number;
  min_index_age?: string;
  min_primary_shard_size?: string;
  copy_alias?: boolean;
}

/** Delete action (no parameters) */
export type DeleteAction = Record<string, never>;

/** Replica count action */
export interface ReplicaCountAction {
  number_of_replicas: number;
}

/** Force merge action */
export interface ForceMergeAction {
  max_num_segments: number;
  wait_for_completion?: boolean;
  task_execution_timeout?: string;
}

/** Shrink action */
export interface ShrinkAction {
  num_new_shards?: number;
  max_shard_size?: string;
  target_index_name_template?: string | { source: string };
  percentage_of_source_shards?: number;
  aliases?: AliasConfig[];
  switch_aliases?: boolean;
  force_unsafe?: boolean;
}

/** Alias configuration for shrink action */
export interface AliasConfig {
  alias: string;
  is_write_index?: boolean;
  filter?: Record<string, unknown>;
  routing?: string;
}

/** Snapshot action */
export interface SnapshotAction {
  repository: string;
  snapshot: string;
}

/** Close action (no parameters) */
export type CloseAction = Record<string, never>;

/** Open action (no parameters) */
export type OpenAction = Record<string, never>;

/** Convert index to remote action */
export interface ConvertIndexToRemoteAction {
  repository: string;
  snapshot: string;
}

/** Rollup action */
export interface RollupAction {
  ism_rollup: ISMRollupConfig;
}

/** ISM Rollup configuration */
export interface ISMRollupConfig {
  description?: string;
  target_index: string;
  target_index_settings?: Record<string, unknown>;
  page_size?: number;
  dimensions: RollupDimension[];
  metrics: RollupMetric[];
}

/** Rollup dimension configuration */
export interface RollupDimension {
  date_histogram?: DateHistogramDimension;
  terms?: TermsDimension;
  histogram?: HistogramDimension;
}

/** Date histogram dimension */
export interface DateHistogramDimension {
  fixed_interval?: string;
  calendar_interval?: string;
  source_field: string;
  target_field: string;
  timezone?: string;
}

/** Terms dimension */
export interface TermsDimension {
  source_field: string;
  target_field: string;
}

/** Histogram dimension */
export interface HistogramDimension {
  source_field: string;
  target_field: string;
  interval: number;
}

/** Rollup metric configuration */
export interface RollupMetric {
  source_field: string;
  metrics: RollupMetricType[];
}

/** Rollup metric types */
export interface RollupMetricType {
  sum?: Record<string, never>;
  avg?: Record<string, never>;
  max?: Record<string, never>;
  min?: Record<string, never>;
  value_count?: Record<string, never>;
}

/** Stop replication action (no parameters) */
export type StopReplicationAction = Record<string, never>;

/** Index priority action */
export interface IndexPriorityAction {
  priority: number;
}

/** Allocation action */
export interface AllocationAction {
  require?: Record<string, string>;
  include?: Record<string, string>;
  exclude?: Record<string, string>;
  wait_for?: boolean;
}

/** Notification action */
export interface NotificationAction {
  destination: NotificationDestination;
  message_template: MessageTemplate;
}

/** Notification destination options */
export interface NotificationDestination {
  chime?: { url: string };
  slack?: { url: string };
  custom_webhook?: CustomWebhook;
}

/** Custom webhook configuration */
export interface CustomWebhook {
  url: string;
  header_params?: Record<string, string>;
  method?: string;
}

/** Message template for notifications */
export interface MessageTemplate {
  source: string;
  lang?: string;
}

/** Warm migration action */
export type WarmMigrationAction = Record<string, never>;

/** Cold migration action */
export type ColdMigrationAction = Record<string, never>;

/** Cold delete action */
export type ColdDeleteAction = Record<string, never>;

/** Retry configuration for actions */
export interface RetryConfig {
  count: number;
  backoff?: 'exponential' | 'constant';
  delay?: string;
}

// ============================================================================
// Validation and Analysis Types
// ============================================================================

/** Validation error with location information */
export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  path?: string;
}

/** Result of policy validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Analysis result for policy issues */
export interface AnalysisResult {
  type: 'unreachable' | 'no-terminal' | 'circular' | 'no-actions' | 'no-conditions' | 'invalid-ref';
  severity: 'error' | 'warning' | 'info';
  message: string;
  stateName?: string;
  details?: string;
}

// ============================================================================
// Diagram Types
// ============================================================================

/** Data structure for state diagram visualization */
export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  defaultState: string;
}

/** Node in the state diagram */
export interface DiagramNode {
  id: string;
  name: string;
  actions: ActionSummary[];
  isDefault: boolean;
  isTerminal: boolean;
  stateType: 'normal' | 'terminal' | 'default' | 'warning';
}

/** Edge (transition) in the state diagram */
export interface DiagramEdge {
  source: string;
  target: string;
  conditions: ConditionSummary[];
  hasConditions: boolean;
}

/** Summary of an action for display */
export interface ActionSummary {
  type: string;
  params?: Record<string, unknown>;
}

/** Summary of a condition for display */
export interface ConditionSummary {
  type: string;
  value: string;
}

// ============================================================================
// Timeline Simulation Types
// ============================================================================

/** Timeline simulation data */
export interface TimelineData {
  events: TimelineEvent[];
  totalDuration: number;
  finalState: string;
  warning?: string;
}

/** Single event in the timeline */
export interface TimelineEvent {
  timestamp: Date;
  fromState: string;
  toState: string;
  triggeredBy: string;
  actions: string[];
  indexAge: string;
  estimatedSize?: string;
  estimatedDocCount?: number;
}

/** Parameters for timeline simulation */
export interface SimulationParams {
  creationDate: Date;
  initialSize: number;
  sizeGrowthRate: number; // bytes per day
  initialDocCount: number;
  docGrowthRate: number; // docs per day
  simulationDays: number;
}

/** Index state during simulation */
export interface IndexState {
  age: number; // milliseconds
  size: number; // bytes
  docCount: number;
  rolloverAge?: number;
  creationDate: Date;
}

// ============================================================================
// Autocomplete Types
// ============================================================================

/** Completion item for editor autocomplete */
export interface CompletionItem {
  label: string;
  kind: 'property' | 'value' | 'snippet';
  detail?: string;
  insertText: string;
  documentation?: string;
}

// ============================================================================
// Reference Documentation Types
// ============================================================================

/** Documentation for an ISM action */
export interface ActionReference {
  name: string;
  description: string;
  parameters: ParameterDoc[];
  example: string;
}

/** Documentation for a transition condition */
export interface ConditionReference {
  name: string;
  description: string;
  valueType: string;
  example: string;
}

/** Documentation for a parameter */
export interface ParameterDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

// ============================================================================
// Persistence Types
// ============================================================================

/** Saved policy entry */
export interface SavedPolicy {
  id: string;
  name: string;
  policy: string;
  timestamp: number;
}

/** Layout preferences for the analyzer */
export interface LayoutPreferences {
  editorWidth: number;
  rightPanelWidth: number;
}

// ============================================================================
// Context State Types
// ============================================================================

/** Active tab in the right panel */
export type AnalyzerTab = 'diagram' | 'timeline' | 'analysis' | 'reference';

/** Complete analyzer state */
export interface AnalyzerState {
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
}
