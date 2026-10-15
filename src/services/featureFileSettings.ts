// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { FeatureFileSettings } from '../storage/featureFileWorkspace';
import type { PolicyDraft } from '../storage/drafts';
import { importPipelineDocument, type PipelineDocument } from '../features/dataprepper/domain/document';
export function pipelineFileSettings(empty: PipelineDocument): FeatureFileSettings<PipelineDocument> {
  return {
    initial: { id: 'dataprepper', content: empty }, label: 'pipeline', empty,
    extract: record => record.content as PipelineDocument,
    reflect: (record, content, fileWorkspace) => ({ id: 'dataprepper', content: { ...record.content, ...content, fileWorkspace } }),
    parse: text => importPipelineDocument(text, empty),
    serialize: content => JSON.stringify({ sourceData: content.sourceData, sourceFormat: content.sourceFormat, pipelineConfig: content.pipelineConfig }, null, 2),
  };
}
export function policyFileSettings(empty: string): FeatureFileSettings<string> {
  return {
    initial: { id: 'ism', content: { policyJson: empty, recentPolicies: [] } }, label: 'policy', empty,
    extract: record => (record.content as PolicyDraft).policyJson,
    reflect: (record, policyJson, fileWorkspace) => ({ id: 'ism', content: { ...(record.content as PolicyDraft), policyJson, fileWorkspace } }),
    parse: text => {
      const value = JSON.parse(text);
      const policy = value?.policy ?? value;
      if (!policy || typeof policy !== 'object' || !Array.isArray(policy.states)) throw new Error('Choose an ISM policy JSON file.');
      return text;
    },
    serialize: text => { JSON.parse(text); return text; },
    legacy: record => {
      const previous = record.content as PolicyDraft;
      const seen = new Set([previous.policyJson]);
      return previous.recentPolicies.filter(item => {
        if (seen.has(item.policy)) return false;
        seen.add(item.policy); return true;
      }).map(item => ({ id: crypto.randomUUID(), name: item.name, content: item.policy, updatedAt: item.timestamp }));
    },
  };
}
