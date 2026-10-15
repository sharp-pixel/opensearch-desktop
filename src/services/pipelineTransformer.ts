// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Pipeline Transformer Service
 * Transforms pipeline configurations for testing with Data Prepper
 * Replaces source with HTTP input and sink with stdout
 */

import * as yaml from 'js-yaml';
import type { PipelineConfig, Pipeline } from '../types/dataPrepper';
import { parsePipelineConfig, isValidationResult } from './pipelineParser';

export interface TransformedPipeline {
  /** The transformed pipeline YAML */
  pipelineYaml: string;
  /** The input data to send via HTTP */
  inputData: string;
  /** Original pipeline names */
  pipelineNames: string[];
}

/**
 * Transform a pipeline configuration for testing
 * - Replaces source with HTTP source (listens on port 2021)
 * - Replaces sink with stdout sink
 * - Preserves all processors
 */
export function transformPipelineForTesting(
  pipelineYaml: string,
  inputData: string
): TransformedPipeline | { error: string } {
  // Parse the pipeline config
  const parseResult = parsePipelineConfig(pipelineYaml);
  
  if (isValidationResult(parseResult)) {
    return { error: parseResult.errors.map(e => e.message).join(', ') };
  }
  
  const pipelineNames = Object.keys(parseResult);
  if (pipelineNames.length === 0) {
    return { error: 'No pipelines found in configuration' };
  }
  
  // Transform each pipeline
  const transformedConfig: PipelineConfig = {};
  
  for (const [name, pipeline] of Object.entries(parseResult)) {
    const transformedPipeline: Pipeline = {
      // Replace source with HTTP source
      source: {
        http: {
          port: 2021,
          path: '/log/ingest',
        },
      },
      // Keep processors as-is
      processor: pipeline.processor,
      // Replace sink with stdout
      sink: [
        {
          stdout: {},
        },
      ],
    };
    
    transformedConfig[name] = transformedPipeline;
  }
  
  // Convert back to YAML
  const transformedYaml = yaml.dump(transformedConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
  
  return {
    pipelineYaml: transformedYaml,
    inputData,
    pipelineNames,
  };
}

/**
 * Check if a result is an error
 */
export function isTransformError(result: TransformedPipeline | { error: string }): result is { error: string } {
  return 'error' in result;
}
