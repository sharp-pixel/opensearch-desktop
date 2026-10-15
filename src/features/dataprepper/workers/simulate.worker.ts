// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { simulatePipeline } from '../../../services/pipelineSimulator';
import type { SourceFormat, ProcessingResult } from '../../../types/dataPrepper';

export interface SimulationRequest { source: string; format: SourceFormat; pipeline: string }
export type SimulationResponse = { result: ProcessingResult } | { error: string };

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { source, format, pipeline } = event.data;
  let response: SimulationResponse;
  try { response = { result: simulatePipeline(source, format, pipeline) }; }
  catch (error) { response = { error: error instanceof Error ? error.message : 'Simulation failed' }; }
  self.postMessage(response);
};
