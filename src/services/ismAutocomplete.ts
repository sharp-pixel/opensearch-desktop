// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Autocomplete Service
 * Provides autocomplete suggestions for ISM policy editing
 */

import { jsonCompletionContext } from './jsonCompletionContext';
import type { ISMPolicy, CompletionItem } from '../types/ism';

/** All ISM action types */
const ACTION_TYPES = [
  { name: 'rollover', description: 'Roll over the index to a new index' },
  { name: 'delete', description: 'Delete the index' },
  { name: 'read_only', description: 'Set the index to read-only' },
  { name: 'read_write', description: 'Set the index to read-write' },
  { name: 'replica_count', description: 'Change the number of replicas' },
  { name: 'force_merge', description: 'Force merge index segments' },
  { name: 'shrink', description: 'Shrink the index to fewer shards' },
  { name: 'snapshot', description: 'Take a snapshot of the index' },
  { name: 'index_priority', description: 'Set the index recovery priority' },
  { name: 'allocation', description: 'Configure shard allocation' },
  { name: 'notification', description: 'Send a notification' },
  { name: 'warm_migration', description: 'Migrate index to warm tier' },
  { name: 'cold_migration', description: 'Migrate index to cold tier' },
  { name: 'cold_delete', description: 'Delete index from cold tier' },
];

/** All ISM condition types */
const CONDITION_TYPES = [
  { name: 'min_index_age', description: 'Minimum age of the index (e.g., "30d")', valueType: 'string' },
  { name: 'min_doc_count', description: 'Minimum number of documents', valueType: 'number' },
  { name: 'min_size', description: 'Minimum size of the index (e.g., "50gb")', valueType: 'string' },
  { name: 'min_rollover_age', description: 'Minimum age since last rollover', valueType: 'string' },
  { name: 'cron', description: 'Cron schedule for transition', valueType: 'object' },
];

/**
 * Get autocomplete suggestions based on context
 */
export function getCompletions(
  policy: ISMPolicy | null,
  _position: { line: number; column: number },
  context: string
): CompletionItem[] {
  const cursor = jsonCompletionContext(context, context.length);
  const path = cursor.path.join('.');
  if (cursor.isValue) {
    return (cursor.key === 'state_name' || cursor.key === 'default_state') ? getStateNameCompletions(policy) : [];
  }
  if (!cursor.isProperty) return [];
  if (path === '') return [{ label: 'policy', kind: 'property', detail: 'ISM policy', insertText: '"policy": { }' }];
  if (path === 'policy') return getPolicyFieldCompletions();
  if (path === 'policy.states') return getStateFieldCompletions();
  if (path === 'policy.states.actions') return getActionTypeCompletions();
  if (path === 'policy.states.transitions') return [
    { label: 'state_name', kind: 'property', detail: 'Target state', insertText: '"state_name": ""' },
    { label: 'conditions', kind: 'property', detail: 'Transition conditions', insertText: '"conditions": { }' },
  ];
  if (path === 'policy.states.transitions.conditions') return getConditionTypeCompletions();
  // Parameter names come from the same action templates used for insertion.
  if (cursor.path.length === 4 && cursor.path.slice(0, 3).join('.') === 'policy.states.actions') {
    const action = cursor.path[3]!;
    if (!ACTION_TYPES.some(item => item.name === action)) return [];
    const template = JSON.parse('{' + getActionSnippet(action) + '}')[action] as Record<string, unknown>;
    return Object.entries(template).map(([label, value]) => ({
      label, kind: 'property', detail: `${action} parameter`, insertText: `${JSON.stringify(label)}: ${JSON.stringify(value)}`,
    }));
  }
  return [];
}

/**
 * Get completions for state names from the policy
 */
export function getStateNameCompletions(policy: ISMPolicy | null): CompletionItem[] {
  if (!policy) {
    return [];
  }

  return policy.policy.states.map(state => ({
    label: state.name,
    kind: 'value' as const,
    detail: `State: ${state.name}`,
    insertText: JSON.stringify(state.name),
    documentation: formatStateDocumentation(state.name, policy),
  }));
}

/**
 * Get completions for action types
 */
export function getActionTypeCompletions(): CompletionItem[] {
  return ACTION_TYPES.map(action => ({
    label: action.name,
    kind: 'property' as const,
    detail: action.description,
    insertText: getActionSnippet(action.name),
    documentation: action.description,
  }));
}

/**
 * Get completions for condition types
 */
export function getConditionTypeCompletions(): CompletionItem[] {
  return CONDITION_TYPES.map(condition => ({
    label: condition.name,
    kind: 'property' as const,
    detail: condition.description,
    insertText: getConditionSnippet(condition.name),
    documentation: `${condition.description}\nType: ${condition.valueType}`,
  }));
}

/**
 * Get completions for policy-level fields
 */
function getPolicyFieldCompletions(): CompletionItem[] {
  return [
    {
      label: 'policy_id',
      kind: 'property',
      detail: 'Unique identifier for the policy',
      insertText: '"policy_id": ""',
      documentation: 'Optional unique identifier for the policy',
    },
    {
      label: 'description',
      kind: 'property',
      detail: 'Description of the policy',
      insertText: '"description": ""',
      documentation: 'Human-readable description of what the policy does',
    },
    {
      label: 'default_state',
      kind: 'property',
      detail: 'Initial state for new indices',
      insertText: '"default_state": ""',
      documentation: 'The state that indices start in when the policy is attached',
    },
    {
      label: 'states',
      kind: 'property',
      detail: 'Array of state definitions',
      insertText: '"states": [\n  {\n    "name": "",\n    "actions": [],\n    "transitions": []\n  }\n]',
      documentation: 'Array of states that define the policy lifecycle',
    },
    {
      label: 'ism_template',
      kind: 'property',
      detail: 'Auto-attach templates',
      insertText: '"ism_template": [\n  {\n    "index_patterns": [""],\n    "priority": 100\n  }\n]',
      documentation: 'Templates for automatically attaching this policy to matching indices',
    },
  ];
}

/**
 * Get completions for state-level fields
 */
function getStateFieldCompletions(): CompletionItem[] {
  return [
    {
      label: 'name',
      kind: 'property',
      detail: 'State name',
      insertText: '"name": ""',
      documentation: 'Unique name for this state',
    },
    {
      label: 'actions',
      kind: 'property',
      detail: 'Actions to perform in this state',
      insertText: '"actions": [\n  { }\n]',
      documentation: 'Array of actions to execute when entering this state',
    },
    {
      label: 'transitions',
      kind: 'property',
      detail: 'Transitions to other states',
      insertText: '"transitions": [\n  {\n    "state_name": "",\n    "conditions": { }\n  }\n]',
      documentation: 'Array of transitions that can move the index to another state',
    },
  ];
}

/**
 * Get snippet for an action type
 */
function getActionSnippet(actionType: string): string {
  switch (actionType) {
    case 'rollover':
      return `"rollover": {\n  "min_index_age": "1d"\n}`;
    case 'delete':
      return `"delete": {}`;
    case 'read_only':
      return `"read_only": {}`;
    case 'read_write':
      return `"read_write": {}`;
    case 'replica_count':
      return `"replica_count": {\n  "number_of_replicas": 1\n}`;
    case 'force_merge':
      return `"force_merge": {\n  "max_num_segments": 1\n}`;
    case 'shrink':
      return `"shrink": {\n  "num_new_shards": 1\n}`;
    case 'snapshot':
      return `"snapshot": {\n  "repository": "my-repo",\n  "snapshot": "{{ctx.index}}"\n}`;
    case 'index_priority':
      return `"index_priority": {\n  "priority": 100\n}`;
    case 'allocation':
      return `"allocation": {\n  "require": {\n    "box_type": "warm"\n  }\n}`;
    case 'notification':
      return `"notification": {\n  "destination": {\n    "slack": {\n      "url": ""\n    }\n  },\n  "message_template": {\n    "source": "Index {{ctx.index}} transitioned"\n  }\n}`;
    case 'warm_migration':
      return `"warm_migration": {}`;
    case 'cold_migration':
      return `"cold_migration": {}`;
    case 'cold_delete':
      return `"cold_delete": {}`;
    default:
      return `"${actionType}": {}`;
  }
}

/**
 * Get snippet for a condition type
 */
function getConditionSnippet(conditionType: string): string {
  switch (conditionType) {
    case 'min_index_age':
      return `"min_index_age": "30d"`;
    case 'min_doc_count':
      return `"min_doc_count": 1000000`;
    case 'min_size':
      return `"min_size": "50gb"`;
    case 'min_rollover_age':
      return `"min_rollover_age": "7d"`;
    case 'cron':
      return `"cron": {\n  "cron": {\n    "expression": "0 0 * * *",\n    "timezone": "UTC"\n  }\n}`;
    default:
      return `"${conditionType}": ""`;
  }
}

/**
 * Format documentation for a state
 */
function formatStateDocumentation(stateName: string, policy: ISMPolicy): string {
  const state = policy.policy.states.find(s => s.name === stateName);
  if (!state) {
    return `State: ${stateName}`;
  }

  const parts: string[] = [`State: ${stateName}`];

  if (state.actions && state.actions.length > 0) {
    const actionNames = state.actions.map(a => {
      const keys = Object.keys(a).filter(k => k !== 'timeout' && k !== 'retry');
      return keys[0] || 'unknown';
    });
    parts.push(`Actions: ${actionNames.join(', ')}`);
  }

  if (state.transitions && state.transitions.length > 0) {
    const targets = state.transitions.map(t => t.state_name);
    parts.push(`Transitions to: ${targets.join(', ')}`);
  }

  if (state.name === policy.policy.default_state) {
    parts.push('(Default state)');
  }

  return parts.join('\n');
}

/**
 * Get all action type names
 */
export function getAllActionTypes(): string[] {
  return ACTION_TYPES.map(a => a.name);
}

/**
 * Get all condition type names
 */
export function getAllConditionTypes(): string[] {
  return CONDITION_TYPES.map(c => c.name);
}

/** Read state names even while another part of the document is incomplete. */
export function getDocumentStateCompletions(text: string): CompletionItem[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/"name"\s*:\s*("(?:\\.|[^"\\])*")/g)) {
    if (jsonCompletionContext(text, match.index).path.join('.') !== 'policy.states') continue;
    try { names.add(JSON.parse(match[1]!)); } catch { /* An incomplete name is not a suggestion. */ }
  }
  return Array.from(names, name => ({ label: name, kind: 'value', detail: `State: ${name}`, insertText: JSON.stringify(name) }));
}
