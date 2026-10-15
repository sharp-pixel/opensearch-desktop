// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Type definitions for Data Prepper Workbench
 */

/** Supported source data formats */
export type SourceFormat = 'json' | 'jsonl' | 'csv';

/** Pipeline configuration structure */
export interface PipelineConfig {
  [pipelineName: string]: Pipeline;
}

/** Single pipeline definition */
export interface Pipeline {
  source?: SourceConfig;
  processor?: ProcessorConfig[];
  sink?: SinkConfig[];
}

/** Source configuration (simplified for simulation) */
export interface SourceConfig {
  [sourceType: string]: Record<string, unknown>;
}

/** Processor configuration */
export interface ProcessorConfig {
  [processorType: string]: ProcessorOptions;
}

/** Processor options with optional when clause */
export interface ProcessorOptions {
  when?: string;
  [key: string]: unknown;
}

/** Sink configuration */
export interface SinkConfig {
  opensearch?: OpenSearchSinkConfig;
  [sinkType: string]: unknown;
}

/** OpenSearch sink configuration */
export interface OpenSearchSinkConfig {
  hosts?: string[];
  index: string;
  index_type?: string;
  template_type?: string;
  template_file?: string;
  document_id?: string;
  document_id_field?: string;
  routing?: string;
  routing_field?: string;
  bulk_size?: number;
  action?: 'index' | 'create' | 'update' | 'delete' | 'upsert';
  ism_policy_file?: string;
  dlq_file?: string;
  dlq?: OpenSearchDLQConfig;
}

/** OpenSearch DLQ (Dead Letter Queue) configuration */
export interface OpenSearchDLQConfig {
  s3?: {
    bucket?: string;
    key_path_prefix?: string;
  };
  file?: {
    path?: string;
  };
}

/** OpenSearch source configuration */
export interface OpenSearchSourceConfig {
  hosts?: string[];
  index?: string;
  indices?: {
    include?: string[];
    exclude?: string[];
  };
  query?: Record<string, unknown>;
  scheduling?: {
    interval?: string;
  };
}

/** Validation error with location */
export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

/** Result of parsing/validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Metadata kept separately from event data. */
export interface EventProcessingMetadata {
  attributes: Record<string, unknown>;
  tags: string[];
}

/** Single processed event */
export interface ProcessedEvent {
  index: number;
  input: Record<string, unknown> | null;
  output: Record<string, unknown>;
  outputMetadata?: EventProcessingMetadata;
  appliedProcessors: string[];
  error?: string;
}

/** Processing error details */
export interface ProcessingError {
  eventIndex: number;
  processor: string;
  message: string;
}

/** Processing statistics */
export interface ProcessingStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  processingTimeMs: number;
}

/** Complete processing result */
export interface ProcessingResult {
  success: boolean;
  events: ProcessedEvent[];
  errors: ProcessingError[];
  stats: ProcessingStats;
  warnings: string[];
}

/** Workbench state for persistence */
export interface WorkbenchState {
  sourceData: string;
  sourceFormat: SourceFormat;
  pipelineConfig: string;
  timestamp: number;
}

/** Recent configuration entry */
export interface RecentConfig {
  id: string;
  name: string;
  sourceFormat: SourceFormat;
  timestamp: number;
  preview: string;
}

/** Processor documentation entry */
export interface ProcessorDoc {
  name: string;
  description: string;
  supported: boolean;
  options: ProcessorOptionDoc[];
  example: string;
}

/** Processor option documentation */
export interface ProcessorOptionDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** Mutate processor configuration */
export interface MutateConfig {
  rename?: Record<string, string>;
  remove?: string[];
  add?: Record<string, unknown>;
  convert?: Record<string, 'integer' | 'float' | 'string' | 'boolean'>;
  lowercase?: string[];
  uppercase?: string[];
  trim?: string[];
  when?: string;
}

/** Add entries processor configuration */
export interface AddEntriesConfig {
  entries: AddEntry[];
  when?: string;
}

export interface AddEntry {
  key?: string;
  metadata_key?: string;
  value?: unknown;
  value_expression?: string;
  format?: string;
  overwrite_if_key_exists?: boolean;
  append_if_key_exists?: boolean;
  add_when?: string;
  iterate_on?: string;
  add_to_element_when?: string;
  flatten_key?: boolean;
  disable_root_keys?: boolean;
  evaluate_when_on_element?: boolean;
}

/** Delete entries processor configuration */
export interface DeleteEntry {
  with_keys?: string[];
  with_keys_regex?: string[];
  exclude_from_delete?: string[];
  delete_when?: string;
  iterate_on?: string;
  delete_from_element_when?: string;
}

export interface DeleteEntriesConfig extends DeleteEntry {
  entries?: DeleteEntry[];
  when?: string;
}

/** Rename keys processor configuration */
export interface RenameKeysConfig {
  entries?: RenameEntry[];
  transform_key?: 'lowercase' | 'uppercase' | 'capitalize' | 'none';
  when?: string;
}

export interface RenameEntry {
  from_key?: string;
  from_key_regex?: string;
  to_key: string;
  overwrite_if_to_key_exists?: boolean;
  rename_when?: string;
}

/** Copy values processor configuration */
export interface CopyValuesConfig {
  entries: CopyEntry[];
  from_list?: string;
  to_list?: string;
  overwrite_if_to_list_exists?: boolean;
  when?: string;
}

export interface CopyEntry {
  from_key: string;
  to_key: string;
  overwrite_if_to_key_exists?: boolean;
  copy_when?: string;
}

/** Date processor configuration */
export interface DateConfig {
  match?: DateMatch[];
  from_time_received?: boolean;
  destination?: string;
  source_timezone?: string;
  destination_timezone?: string;
  locale?: string;
  when?: string;
}

export interface DateMatch {
  key: string;
  patterns: string[];
}

/** Grok processor configuration */
export interface GrokConfig {
  match: GrokMatch;
  pattern_definitions?: Record<string, string>;
  patterns_directories?: string[];
  target_key?: string;
  keep_empty_captures?: boolean;
  named_captures_only?: boolean;
  break_on_match?: boolean;
  keys_to_overwrite?: string[];
  tags_on_match_failure?: string[];
  when?: string;
}

export interface GrokMatch {
  [field: string]: string[];
}

/** Flatten processor configuration */
export interface FlattenConfig {
  /** Source key to flatten. Empty string means root of event */
  source: string;
  /** Target key for flattened fields. Empty string means root of event */
  target: string;
  /** Remove source fields after flattening */
  remove_processed_fields?: boolean;
  /** Remove list indices from keys (converts to lists) */
  remove_list_indices?: boolean;
  /** Remove brackets around indices (only when remove_list_indices is true) */
  remove_brackets?: boolean;
  /** Keys to exclude from flattening */
  exclude_keys?: string[];
  /** Conditional expression */
  when?: string;
}

/** Truncate processor entry configuration */
export interface TruncateEntry {
  /** List of source keys to truncate. If not specified, truncates all string values */
  source_keys?: string[];
  /** Starting index for truncation (default: 0) */
  start_at?: number;
  /** Length of string after truncation */
  length?: number;
  /** Recursively truncate nested map values */
  recursive?: boolean;
  /** Conditional expression for this entry */
  truncate_when?: string;
}

/** Truncate processor configuration */
export interface TruncateConfig {
  /** List of truncation entries */
  entries: TruncateEntry[];
  /** Conditional expression */
  when?: string;
}

/** Mask action configuration for obfuscate processor */
export interface MaskActionConfig {
  /** Character to use for masking (default: *) */
  mask_character?: string;
  /** Length of mask string (default: 3) */
  mask_character_length?: number;
}

/** Obfuscate processor configuration */
export interface ObfuscateConfig {
  /** Source key to obfuscate */
  source: string;
  /** Target key for obfuscated value (if not set, overwrites source) */
  target?: string;
  /** Regex patterns to match for partial obfuscation */
  patterns?: string[];
  /** Obfuscation action configuration */
  action?: {
    mask?: MaskActionConfig;
  };
  /** Only match whole words */
  single_word_only?: boolean;
  /** Conditional expression */
  when?: string;
}


/** Key-Value processor configuration */
export interface KeyValueConfig {
  /** Source field containing key-value data (default: "message") */
  source?: string;
  /** Destination field for parsed data (default: "parsed_message", null for root) */
  destination?: string | null;
  /** Characters that separate key-value pairs (default: "&") */
  field_split_characters?: string;
  /** Regex pattern for field delimiter */
  field_delimiter_regex?: string;
  /** Characters that separate keys from values (default: "=") */
  value_split_characters?: string;
  /** Regex pattern for key-value delimiter */
  key_value_delimiter_regex?: string;
  /** Keys to include (empty means all) */
  include_keys?: string[];
  /** Keys to exclude */
  exclude_keys?: string[];
  /** Default values for keys */
  default_values?: Record<string, unknown>;
  /** Value for non-matching entries */
  non_match_value?: unknown;
  /** Prefix to add to all keys */
  prefix?: string;
  /** Regex pattern for characters to delete from keys */
  delete_key_regex?: string;
  /** Regex pattern for characters to delete from values */
  delete_value_regex?: string;
  /** Transform key case */
  transform_key?: 'lowercase' | 'uppercase' | 'capitalize' | 'none';
  /** Trim whitespace handling */
  whitespace?: 'strict' | 'lenient';
  /** Skip duplicate values */
  skip_duplicate_values?: boolean;
  /** Remove brackets from values */
  remove_brackets?: boolean;
  /** Drop keys with no value */
  drop_keys_with_no_value?: boolean;
  /** Overwrite existing destination */
  overwrite_if_destination_exists?: boolean;
  /** Conditional expression */
  when?: string;
}

/** CSV processor configuration */
export interface CsvProcessorConfig {
  /** Source field containing CSV data (default: "message") */
  source?: string;
  /** Column separator character (default: ",") */
  delimiter?: string;
  /** Text qualifier character (default: '"') */
  quote_character?: string;
  /** User-specified column names */
  column_names?: string[];
  /** Field containing column names from event */
  column_names_source_key?: string;
  /** Delete header field after parsing */
  delete_header?: boolean;
  /** Delete source field after parsing */
  delete_source?: boolean;
  /** Conditional expression */
  when?: string;
}

/** Parse JSON processor configuration */
export interface ParseJsonConfig {
  /** Source field containing JSON string (default: "message") */
  source?: string;
  /** Destination field for parsed data (null/undefined for root) */
  destination?: string | null;
  /** JSON pointer to specific field to parse */
  pointer?: string;
  /** Depth limit for nested parsing (0 = unlimited) */
  depth?: number;
  /** Overwrite existing destination */
  overwrite_if_destination_exists?: boolean;
  /** Delete source field after parsing */
  delete_source?: boolean;
  /** Conditional expression */
  when?: string;
}

/** Split string entry configuration */
export interface SplitStringEntry {
  /** Source field to split */
  source: string;
  /** Delimiter character */
  delimiter?: string;
  /** Delimiter regex pattern */
  delimiter_regex?: string;
  /** Conditional expression for this entry */
  split_when?: string;
}

/** Split string processor configuration */
export interface SplitStringConfig {
  /** List of split entries */
  entries: SplitStringEntry[];
  /** Conditional expression */
  when?: string;
}

/** Substitute string entry configuration */
export interface SubstituteStringEntry {
  /** Source field to modify */
  source: string;
  /** Regex pattern to match */
  from: string;
  /** Replacement string */
  to: string;
  /** Conditional expression for this entry */
  substitute_when?: string;
}

/** Substitute string processor configuration */
export interface SubstituteStringConfig {
  /** List of substitution entries */
  entries: SubstituteStringEntry[];
  /** Conditional expression */
  when?: string;
}
