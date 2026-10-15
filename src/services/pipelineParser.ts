// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Pipeline Parser Service
 * Parses and validates Data Prepper pipeline YAML configurations
 */

import * as yaml from 'js-yaml';
import type {
  PipelineConfig,
  SinkConfig,
  SourceConfig,
  ValidationError,
  ValidationResult,
  ProcessorConfig,
} from '../types/dataPrepper';

/** Supported processor types for simulation */
export const SUPPORTED_PROCESSORS = [
  'mutate',
  'add_entries',
  'delete_entries',
  'rename_keys',
  'copy_values',
  'date',
  'grok',
  'flatten',
  'truncate',
  'obfuscate',
  'key_value',
  'csv',
  'parse_json',
  'split_string',
  'substitute_string',
] as const;

/** All known Data Prepper processor types */
const KNOWN_PROCESSORS = [
  ...SUPPORTED_PROCESSORS,
  'aggregate',
  'anomaly_detector',
  'drop_events',
  'translate',
  'user_agent',
] as const;

/**
 * Parse pipeline YAML configuration
 */
export function parsePipelineConfig(yamlContent: string): PipelineConfig | ValidationResult {
  const trimmed = yamlContent.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = yaml.load(trimmed);
    
    if (parsed === null || parsed === undefined) {
      return {};
    }
    
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        errors: [{
          line: 1,
          column: 1,
          message: 'Pipeline configuration must be a YAML object',
          severity: 'error',
        }],
      };
    }

    return parsed as PipelineConfig;
  } catch (e) {
    if (e instanceof yaml.YAMLException) {
      return {
        valid: false,
        errors: [{
          line: e.mark?.line ? e.mark.line + 1 : 1,
          column: e.mark?.column ? e.mark.column + 1 : 1,
          message: e.reason || 'Invalid YAML syntax',
          severity: 'error',
        }],
      };
    }
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        message: e instanceof Error ? e.message : 'Unknown parsing error',
        severity: 'error',
      }],
    };
  }
}

/**
 * Check if result is a validation error
 */
export function isValidationResult(result: PipelineConfig | ValidationResult): result is ValidationResult {
  return 'valid' in result && typeof result.valid === 'boolean' && 'errors' in result && Array.isArray(result.errors);
}

/**
 * Validate pipeline structure and schema
 */
export function validatePipelineSchema(config: PipelineConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  let lineEstimate = 1;

  for (const [pipelineName, pipeline] of Object.entries(config)) {
    if (typeof pipeline !== 'object' || pipeline === null) {
      errors.push({
        line: lineEstimate,
        column: 1,
        message: `Pipeline "${pipelineName}" must be an object`,
        severity: 'error',
      });
      continue;
    }

    // Validate processors
    if (pipeline.processor !== undefined) {
      if (!Array.isArray(pipeline.processor)) {
        errors.push({
          line: lineEstimate,
          column: 1,
          message: `Pipeline "${pipelineName}": processor must be an array`,
          severity: 'error',
        });
      } else {
        for (let i = 0; i < pipeline.processor.length; i++) {
          const proc = pipeline.processor[i];
          if (typeof proc !== 'object' || proc === null || Array.isArray(proc)) {
            errors.push({
              line: lineEstimate,
              column: 1,
              message: `Pipeline "${pipelineName}": processor[${i}] must be an object`,
              severity: 'error',
            });
            continue;
          }

          const procTypes = Object.keys(proc);
          if (procTypes.length !== 1) {
            errors.push({
              line: lineEstimate,
              column: 1,
              message: `Pipeline "${pipelineName}": processor[${i}] must contain exactly one processor`,
              severity: 'error',
            });
          }

          for (const procType of procTypes) {
            if (!KNOWN_PROCESSORS.includes(procType as typeof KNOWN_PROCESSORS[number])) {
              errors.push({
                line: lineEstimate,
                column: 1,
                message: `Pipeline "${pipelineName}": unknown processor type "${procType}"`,
                severity: 'warning',
              });
            }
          }
        }
      }
    }

    // Validate sinks
    if (pipeline.sink !== undefined) {
      if (!Array.isArray(pipeline.sink)) {
        errors.push({
          line: lineEstimate,
          column: 1,
          message: `Pipeline "${pipelineName}": sink must be an array`,
          severity: 'error',
        });
      } else {
        for (let i = 0; i < pipeline.sink.length; i++) {
          const sink = pipeline.sink[i];
          if (typeof sink !== 'object' || sink === null) {
            errors.push({
              line: lineEstimate,
              column: 1,
              message: `Pipeline "${pipelineName}": sink[${i}] must be an object`,
              severity: 'error',
            });
          }
        }
      }
    }

    lineEstimate += 10; // Rough estimate for error positioning
  }

  return errors;
}

/**
 * Get list of unsupported processors in config
 */
export function getUnsupportedProcessors(config: PipelineConfig): string[] {
  const unsupported = new Set<string>();

  for (const pipeline of Object.values(config)) {
    if (pipeline.processor) {
      for (const proc of pipeline.processor) {
        for (const procType of Object.keys(proc)) {
          if (!SUPPORTED_PROCESSORS.includes(procType as typeof SUPPORTED_PROCESSORS[number])) {
            unsupported.add(procType);
          }
        }
      }
    }
  }

  return Array.from(unsupported);
}

/**
 * Extract all sink configurations from pipeline config
 */
export function extractSinkConfigs(config: PipelineConfig): SinkConfig[] {
  const sinks: SinkConfig[] = [];

  for (const pipeline of Object.values(config)) {
    if (pipeline.sink && Array.isArray(pipeline.sink)) {
      sinks.push(...pipeline.sink);
    }
  }

  return sinks;
}

/**
 * Extract OpenSearch sink configurations
 */
export function extractOpenSearchSinks(config: PipelineConfig): SinkConfig[] {
  return extractSinkConfigs(config).filter((sink) => sink.opensearch !== undefined);
}

/**
 * Extract all source configurations from pipeline config
 */
export function extractSourceConfigs(config: PipelineConfig): SourceConfig[] {
  const sources: SourceConfig[] = [];

  for (const pipeline of Object.values(config)) {
    if (pipeline.source) {
      sources.push(pipeline.source);
    }
  }

  return sources;
}

/**
 * Extract OpenSearch source configurations
 */
export function extractOpenSearchSources(config: PipelineConfig): SourceConfig[] {
  return extractSourceConfigs(config).filter((source) => source.opensearch !== undefined);
}

/**
 * Get all processors from a pipeline config
 */
export function extractProcessors(config: PipelineConfig): ProcessorConfig[] {
  const processors: ProcessorConfig[] = [];

  for (const pipeline of Object.values(config)) {
    if (pipeline.processor && Array.isArray(pipeline.processor)) {
      processors.push(...pipeline.processor);
    }
  }

  return processors;
}

/**
 * Validate complete pipeline configuration
 */
export function validatePipeline(yamlContent: string): ValidationResult {
  const parseResult = parsePipelineConfig(yamlContent);
  
  if (isValidationResult(parseResult)) {
    return parseResult;
  }

  const schemaErrors = validatePipelineSchema(parseResult);
  
  return {
    valid: schemaErrors.filter((e) => e.severity === 'error').length === 0,
    errors: schemaErrors,
  };
}
