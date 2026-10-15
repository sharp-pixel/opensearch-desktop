// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ProcessorConfig, ProcessingError } from '../types/dataPrepper';

// Options implemented by the local simulator, not the complete upstream schema.
const options: Record<string, string[]> = {
  add_entries: ['entries'], delete_entries: ['entries', 'with_keys', 'with_keys_regex', 'exclude_from_delete', 'delete_when', 'iterate_on', 'delete_from_element_when'],
  rename_keys: ['entries', 'transform_key'], copy_values: ['entries', 'from_list', 'to_list', 'overwrite_if_to_list_exists'],
  parse_json: ['source', 'destination', 'pointer', 'depth', 'overwrite_if_destination_exists', 'delete_source', 'parse_when', 'tags_on_failure'],
  csv: ['source', 'delimiter', 'quote_character', 'column_names', 'column_names_source_key', 'delete_header', 'delete_source', 'csv_when', 'multiline'],
  flatten: ['source', 'target', 'remove_processed_fields', 'remove_source_keys', 'remove_list_indices', 'remove_list_elements', 'remove_brackets', 'exclude_keys', 'flatten_separator', 'flatten_when'],
  split_string: ['entries'], substitute_string: ['entries'], truncate: ['entries'],
  obfuscate: ['source', 'target', 'patterns', 'action', 'single_word_only', 'obfuscate_when', 'tags_on_match_failure'],
  date: ['match', 'from_time_received', 'destination', 'date_when'],
  grok: ['match', 'pattern_definitions', 'target_key', 'keep_empty_captures', 'named_captures_only', 'break_on_match', 'keys_to_overwrite', 'grok_when', 'tags_on_match_failure'],
  key_value: ['source', 'destination', 'field_split_characters', 'field_delimiter_regex', 'value_split_characters', 'key_value_delimiter_regex', 'include_keys', 'exclude_keys', 'default_values', 'non_match_value', 'prefix', 'delete_key_regex', 'delete_value_regex', 'transform_key', 'whitespace', 'skip_duplicate_values', 'remove_brackets', 'drop_keys_with_no_value', 'overwrite_if_destination_exists', 'destination_conflict_strategy', 'key_value_when'],
};
const entryOptions: Record<string, string[]> = {
  add_entries: ['key', 'metadata_key', 'value', 'value_expression', 'format', 'overwrite_if_key_exists', 'append_if_key_exists', 'add_when', 'iterate_on', 'add_to_element_when', 'flatten_key', 'disable_root_keys', 'evaluate_when_on_element'],
  copy_values: ['from_key', 'to_key', 'overwrite_if_to_key_exists', 'copy_when'],
  rename_keys: ['from_key', 'from_key_regex', 'to_key', 'overwrite_if_to_key_exists', 'rename_when'],
  delete_entries: ['with_keys', 'with_keys_regex', 'exclude_from_delete', 'delete_when', 'iterate_on', 'delete_from_element_when'],
  split_string: ['source', 'delimiter', 'delimiter_regex', 'split_when'],
  substitute_string: ['source', 'from', 'to', 'substitute_when'],
  truncate: ['source_keys', 'start_at', 'length', 'recursive', 'truncate_when'],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getProcessorSimulationDiagnostics(processors: ProcessorConfig[]): { warnings: string[]; errors: ProcessingError[] } {
  const warnings = new Set<string>();
  const errors: ProcessingError[] = [];
  for (const processor of processors) {
    for (const [name, rawConfig] of Object.entries(processor)) {
      if (!options[name]) {
        if (name === 'mutate') warnings.add('mutate is a legacy simulator extension, not a Data Prepper processor.');
        continue;
      }
      const error = (message: string) => errors.push({ eventIndex: -1, processor: name, message });
      if (rawConfig != null && !isObject(rawConfig)) {
        error('Processor configuration must be an object');
        continue;
      }
      const config = (rawConfig ?? {}) as Record<string, unknown>;
      for (const key of ['tags_on_failure', 'tags_on_match_failure']) {
        if (options[name]!.includes(key) && config[key] !== undefined &&
            (!Array.isArray(config[key]) || (config[key] as unknown[]).some(tag => typeof tag !== 'string'))) {
          error(`${key} must be an array of strings`);
        }
      }
      const expressionConfigs = [config, ...(Array.isArray(config.entries) ? config.entries.filter(isObject) : [])];
      if (expressionConfigs.some(value => Object.entries(value).some(([key, expression]) =>
          (key.endsWith('_when') || ['when', 'value_expression', 'key'].includes(key)) && typeof expression === 'string' && /[=!]~/.test(expression)))) {
        warnings.add(`${name}: expression patterns use JavaScript regex; Java regex parity is limited.`);
      }
      const validateRegex = (pattern: unknown) => {
        if (typeof pattern !== 'string') { error('Regex patterns must be strings'); return; }
        try { new RegExp(pattern); }
        catch { error('Invalid key regex for local simulation'); }
        warnings.add(`${name}: key patterns use JavaScript regex; Java regex parity is limited.`);
      };
      const validateDelete = (entry: Record<string, unknown>) => {
        for (const key of ['with_keys', 'with_keys_regex', 'exclude_from_delete']) {
          if (entry[key] !== undefined && (!Array.isArray(entry[key]) || (entry[key] as unknown[]).some(value => typeof value !== 'string'))) {
            error(`${key} must be an array of strings`);
          }
        }
        if (entry.delete_from_element_when !== undefined && entry.iterate_on === undefined) {
          error('delete_from_element_when requires iterate_on');
        }
        if (Array.isArray(entry.exclude_from_delete) && entry.exclude_from_delete.length &&
            (!Array.isArray(entry.with_keys_regex) || !entry.with_keys_regex.length)) {
          error('exclude_from_delete requires with_keys_regex');
        }
        if (Array.isArray(entry.with_keys_regex)) entry.with_keys_regex.forEach(validateRegex);
      };
      const unknownOptions = Object.keys(config).filter(key => key !== 'when' && !options[name]!.includes(key));
      if (unknownOptions.length) warnings.add(`${name}: options not simulated: ${unknownOptions.join(', ')}`);
      if (name === 'date' || name === 'grok') {
        warnings.add(`${name}: local date formats and Grok/regex patterns cover a subset of Data Prepper behavior.`);
      }
      if (name === 'obfuscate' && isObject(config.action) && !('mask' in config.action)) {
        error('Only the obfuscate mask action is simulated');
      }
      if (name === 'csv' && (config.multiline === true || config.multi_line === true)) error('CSV multiline event expansion is not simulated');
      if (name === 'flatten' && config.flatten_separator !== undefined &&
          (typeof config.flatten_separator !== 'string' || config.flatten_separator.length !== 1)) {
        error('flatten_separator must be exactly one character');
      }
      if (name === 'key_value' && config.destination_conflict_strategy != null) {
        if (config.overwrite_if_destination_exists != null) error('overwrite_if_destination_exists and destination_conflict_strategy cannot both be set');
        if (typeof config.destination_conflict_strategy !== 'string' ||
            !['skip', 'overwrite', 'merge_preserve_existing_keys', 'merge_overwrite_existing_keys'].includes(config.destination_conflict_strategy.toLowerCase())) {
          error('Invalid destination_conflict_strategy');
        }
      }
      if (name === 'copy_values' && (config.from_list !== undefined || config.to_list !== undefined)) {
        if (typeof config.from_list !== 'string' || typeof config.to_list !== 'string') error('from_list and to_list must both be specified as strings');
      }
      if (name === 'rename_keys') {
        const transform = config.transform_key !== undefined && config.transform_key !== 'none';
        if (transform && !['lowercase', 'uppercase', 'capitalize'].includes(config.transform_key as string)) error('Invalid transform_key');
        if (transform === (config.entries !== undefined)) error('Exactly one of entries or transform_key is required');
        if (transform) continue;
      }
      if (name === 'delete_entries') {
        if (['entries', 'with_keys', 'with_keys_regex'].filter(key => config[key] !== undefined).length !== 1) {
          error('Exactly one of entries, with_keys or with_keys_regex is required');
        }
        validateDelete(config);
        if (config.entries === undefined) continue;
      }
      if (!entryOptions[name]) continue;
      if (!Array.isArray(config.entries)) {
        error('entries must be an array');
        continue;
      }
      for (const entry of config.entries) {
        if (!isObject(entry)) { error('Each entry must be an object'); continue; }
        const unknownEntryOptions = Object.keys(entry).filter(key => !entryOptions[name]!.includes(key));
        if (unknownEntryOptions.length) warnings.add(`${name}: entry options not simulated: ${unknownEntryOptions.join(', ')}`);
        if (name === 'delete_entries') validateDelete(entry);
        if (name === 'rename_keys') {
          if ((entry.from_key !== undefined) === (entry.from_key_regex !== undefined)) error('Exactly one of from_key or from_key_regex is required');
          if (typeof entry.to_key !== 'string' || !entry.to_key.length) error('to_key must be a nonempty string');
          if (entry.from_key_regex !== undefined) validateRegex(entry.from_key_regex);
        }
        if (name === 'add_entries') {
          if ((entry.key !== undefined) === (entry.metadata_key !== undefined)) error('Exactly one of key or metadata_key is required');
          if (entry.key !== undefined && (typeof entry.key !== 'string' || !entry.key.length)) error('key must be a nonempty string');
          if (entry.metadata_key !== undefined && typeof entry.metadata_key !== 'string') error('metadata_key must be a string');
          if (entry.metadata_key !== undefined && entry.iterate_on !== undefined) error('iterate_on cannot be applied to metadata');
          if (['value', 'value_expression', 'format'].filter(key => entry[key] != null).length !== 1) {
            error('Exactly one non-null value, value_expression or format is required');
          }
          if (entry.overwrite_if_key_exists === true && entry.append_if_key_exists === true) {
            error('overwrite_if_key_exists and append_if_key_exists cannot both be true');
          }
          if (entry.iterate_on !== undefined && typeof entry.iterate_on !== 'string') error('iterate_on must be a string');
          for (const key of ['flatten_key', 'disable_root_keys', 'evaluate_when_on_element', 'overwrite_if_key_exists', 'append_if_key_exists']) {
            if (entry[key] !== undefined && typeof entry[key] !== 'boolean') error(`${key} must be a boolean`);
          }
          if (entry.iterate_on === undefined && (entry.flatten_key === false || entry.disable_root_keys === false || entry.add_to_element_when !== undefined)) {
            error('flatten_key=false, disable_root_keys=false and add_to_element_when require iterate_on');
          }
          if (entry.evaluate_when_on_element === true && (entry.iterate_on === undefined || entry.add_to_element_when === undefined)) {
            error('evaluate_when_on_element requires iterate_on and add_to_element_when');
          }
        }
        if (name === 'split_string') {
          const delimiter = typeof entry.delimiter === 'string' && entry.delimiter.length > 0;
          const regex = typeof entry.delimiter_regex === 'string' && entry.delimiter_regex.length > 0;
          if (delimiter === regex) error('Exactly one of delimiter or delimiter_regex must be specified');
          if (regex) {
            try { new RegExp(entry.delimiter_regex as string); }
            catch { error('Invalid delimiter_regex for local simulation'); }
          }
        }
        if (name === 'substitute_string') {
          if (typeof entry.from !== 'string' || typeof entry.to !== 'string') error('from and to must be strings');
          else {
            try { new RegExp(entry.from); }
            catch { error('Invalid substitution regex for local simulation'); }
          }
        }
        if (name === 'truncate') {
          if (entry.start_at === undefined && entry.length === undefined) error('start_at or length is required');
          for (const key of ['start_at', 'length']) {
            if (entry[key] !== undefined && (!Number.isInteger(entry[key]) || (entry[key] as number) < 0)) {
              error(`${key} must be a nonnegative integer`);
            }
          }
        }
      }
    }
  }
  return { warnings: [...warnings], errors };
}
