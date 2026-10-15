// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Pipeline Simulator Service
 * Simulates Data Prepper pipeline execution in the browser
 */

import type {
  PipelineConfig,
  ProcessorConfig,
  ProcessingResult,
  ProcessedEvent,
  ProcessingError,
  SourceFormat,
} from '../types/dataPrepper';
import { parseSourceData } from './sourceDataParser';
import { getProcessorSimulationDiagnostics } from './processorSimulationDiagnostics';
import { peekEventMetadata } from './processors/eventMetadata';
import { parsePipelineConfig, isValidationResult, getUnsupportedProcessors, validatePipelineSchema } from './pipelineParser';
import {
  applyMutate,
  applyAddEntries,
  applyDeleteEntries,
  applyRenameKeys,
  applyCopyValues,
  applyDate,
  applyGrok,
  applyFlatten,
  applyTruncate,
  applyObfuscate,
  applyKeyValue,
  applyCsv,
  applyParseJson,
  applySplitString,
  applySubstituteString,
  evaluateCondition,
  deepClone,
} from './processors';

/**
 * Processor function type
 */
type ProcessorFn = (event: Record<string, unknown>, config: Record<string, unknown>) => Record<string, unknown>;

/**
 * Map of supported processor types to their implementations
 */
const PROCESSOR_MAP: Record<string, ProcessorFn> = {
  mutate: (event, config) => applyMutate(event, config as unknown as Parameters<typeof applyMutate>[1]),
  add_entries: (event, config) => applyAddEntries(event, config as unknown as Parameters<typeof applyAddEntries>[1]),
  delete_entries: (event, config) => applyDeleteEntries(event, config as unknown as Parameters<typeof applyDeleteEntries>[1]),
  rename_keys: (event, config) => applyRenameKeys(event, config as unknown as Parameters<typeof applyRenameKeys>[1]),
  copy_values: (event, config) => applyCopyValues(event, config as unknown as Parameters<typeof applyCopyValues>[1]),
  date: (event, config) => applyDate(event, config as unknown as Parameters<typeof applyDate>[1]),
  grok: (event, config) => applyGrok(event, config as unknown as Parameters<typeof applyGrok>[1]),
  flatten: (event, config) => applyFlatten(event, config as unknown as Parameters<typeof applyFlatten>[1]),
  truncate: (event, config) => applyTruncate(event, config as unknown as Parameters<typeof applyTruncate>[1]),
  obfuscate: (event, config) => applyObfuscate(event, config as unknown as Parameters<typeof applyObfuscate>[1]),
  key_value: (event, config) => applyKeyValue(event, config as unknown as Parameters<typeof applyKeyValue>[1]),
  csv: (event, config) => applyCsv(event, config as unknown as Parameters<typeof applyCsv>[1]),
  parse_json: (event, config) => applyParseJson(event, config as unknown as Parameters<typeof applyParseJson>[1]),
  split_string: (event, config) => applySplitString(event, config as unknown as Parameters<typeof applySplitString>[1]),
  substitute_string: (event, config) => applySubstituteString(event, config as unknown as Parameters<typeof applySubstituteString>[1]),
};

const PROCESSOR_CONDITIONS: Record<string, string> = {
  parse_json: 'parse_when', csv: 'csv_when', date: 'date_when',
  grok: 'grok_when', obfuscate: 'obfuscate_when', key_value: 'key_value_when',
};

/**
 * Simulate pipeline execution
 */
export function simulatePipeline(
  sourceData: string,
  sourceFormat: SourceFormat,
  pipelineYaml: string
): ProcessingResult {
  const startTime = performance.now();
  const errors: ProcessingError[] = [];
  const warnings: string[] = [];

  // Parse source data
  const parseResult = parseSourceData(sourceData, sourceFormat);
  if (!parseResult.success) {
    return {
      success: false,
      events: [],
      errors: parseResult.errors.map((msg, i) => ({
        eventIndex: i,
        processor: 'source_parser',
        message: msg,
      })),
      stats: {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        processingTimeMs: performance.now() - startTime,
      },
      warnings: [],
    };
  }

  // Parse pipeline config
  const pipelineResult = parsePipelineConfig(pipelineYaml);
  const schemaErrors = isValidationResult(pipelineResult)
    ? pipelineResult.errors
    : validatePipelineSchema(pipelineResult).filter(error => error.severity === 'error');
  if (!isValidationResult(pipelineResult) && Object.keys(pipelineResult).length > 1) {
    schemaErrors.push({ line: 1, column: 1, severity: 'error', message: 'Simulation supports one pipeline at a time. Select a single pipeline; routing between pipelines is not simulated.' });
  }
  if (isValidationResult(pipelineResult) || schemaErrors.length > 0) {
    return {
      success: false,
      events: [],
      errors: schemaErrors.map((err) => ({
        eventIndex: -1,
        processor: 'pipeline_parser',
        message: `Line ${err.line}: ${err.message}`,
      })),
      stats: {
        totalEvents: parseResult.events.length,
        successfulEvents: 0,
        failedEvents: 0,
        processingTimeMs: performance.now() - startTime,
      },
      warnings: [],
    };
  }

  // Check for unsupported processors
  const unsupported = getUnsupportedProcessors(pipelineResult);
  if (unsupported.length > 0) {
    warnings.push(`Unsupported processors will be skipped: ${unsupported.join(', ')}`);
  }

  // The schema check above limits simulation to a single pipeline.
  const allProcessors = extractAllProcessors(pipelineResult);
  const diagnostics = getProcessorSimulationDiagnostics(allProcessors);
  warnings.push(...diagnostics.warnings);
  if (diagnostics.errors.length) {
    return {
      success: false, events: [], errors: diagnostics.errors, warnings,
      stats: { totalEvents: parseResult.events.length, successfulEvents: 0, failedEvents: 0, processingTimeMs: performance.now() - startTime },
    };
  }

  // Process each event
  const processedEvents: ProcessedEvent[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < parseResult.events.length; i++) {
    const inputEvent = parseResult.events[i];
    if (!inputEvent) continue;
    
    const result = processEvent(inputEvent, allProcessors, i, errors);
    const metadata = peekEventMetadata(result.output);
    
    processedEvents.push({
      index: i,
      input: inputEvent,
      output: result.output,
      ...(metadata && (metadata.tags.length || Object.keys(metadata.attributes).length) ? { outputMetadata: deepClone(metadata) } : {}),
      appliedProcessors: result.appliedProcessors,
      error: result.error,
    });

    if (result.error) {
      failCount++;
    } else {
      successCount++;
    }
  }

  const endTime = performance.now();

  return {
    success: errors.length === 0,
    events: processedEvents,
    errors,
    stats: {
      totalEvents: parseResult.events.length,
      successfulEvents: successCount,
      failedEvents: failCount,
      processingTimeMs: endTime - startTime,
    },
    warnings,
  };
}

/**
 * Extract all processors from all pipelines in order
 */
function extractAllProcessors(config: PipelineConfig): ProcessorConfig[] {
  const processors: ProcessorConfig[] = [];
  
  for (const pipeline of Object.values(config)) {
    if (pipeline.processor && Array.isArray(pipeline.processor)) {
      processors.push(...pipeline.processor);
    }
  }
  
  return processors;
}

/**
 * Process a single event through all processors
 */
function processEvent(
  input: Record<string, unknown>,
  processors: ProcessorConfig[],
  eventIndex: number,
  errors: ProcessingError[]
): { output: Record<string, unknown>; appliedProcessors: string[]; error?: string } {
  let current = deepClone(input);
  const appliedProcessors: string[] = [];
  let eventError: string | undefined;

  for (const processorConfig of processors) {
    for (const [processorType, config] of Object.entries(processorConfig)) {
      const processorFn = PROCESSOR_MAP[processorType];
      
      if (!processorFn) {
        // Skip unsupported processors
        continue;
      }

      try {
        // Check when condition
        const configObj = config as Record<string, unknown> | undefined;
        if (configObj?.when && typeof configObj.when === 'string') {
          if (!evaluateCondition(current, configObj.when)) {
            continue; // Skip this processor for this event
          }
        }
        const condition = configObj?.[PROCESSOR_CONDITIONS[processorType] ?? ''];
        if (typeof condition === 'string' && !evaluateCondition(current, condition)) continue;

        // Apply processor
        const result = processorFn(current, configObj || {});
        if (result) {
          current = result;
        }
        appliedProcessors.push(processorType);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        errors.push({
          eventIndex,
          processor: processorType,
          message,
        });
        eventError = `${processorType}: ${message}`;
        // Continue processing other processors
      }
    }
  }

  return { output: current, appliedProcessors, error: eventError };
}

/**
 * Get list of supported processor types
 */
export function getSupportedProcessors(): string[] {
  return Object.keys(PROCESSOR_MAP);
}

/**
 * Check if a processor type is supported
 */
export function isProcessorSupported(processorType: string): boolean {
  return processorType in PROCESSOR_MAP;
}
