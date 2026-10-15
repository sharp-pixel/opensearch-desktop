// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { validatePolicyJson, parsePolicy } from '../domain/ismPolicyValidator';
import { analyzePolicy } from '../domain/ismPolicyAnalyzer';
import { generateDiagramData } from '../domain/ismDiagramGenerator';
import { simulateTimeline } from '../domain/ismTimelineSimulator';
import type { SimulationParams } from '../../../types/ism';

export function analyzePolicyDraft(json: string, params: SimulationParams) {
  const validation = validatePolicyJson(json);
  const policy = validation.valid ? parsePolicy(json) : null;
  return { validationErrors: validation.errors, parsedPolicy: policy,
    diagramData: policy ? generateDiagramData(policy) : null,
    analysisResults: policy ? analyzePolicy(policy) : [],
    timelineData: policy ? simulateTimeline(policy, params) : null };
}
