// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Action Reference Service
 * Documentation for all ISM actions and conditions
 */

import type { ActionReference, ConditionReference, ParameterDoc } from '../../../types/ism';

/**
 * Complete documentation for all ISM actions
 */
export const ACTION_REFERENCE: ActionReference[] = [
  {
    name: 'rollover',
    description: 'Rolls over the index to a new index when conditions are met. Creates a new index and updates the alias to point to it. The index format must match the pattern: ^.*-\\d+$ (e.g., logs-000001).',
    parameters: [
      { name: 'min_size', type: 'string', required: false, description: 'Minimum size of total primary shard storage (not counting replicas) required to roll over (e.g., "50gb", "100gb")' },
      { name: 'min_primary_shard_size', type: 'string', required: false, description: 'Minimum storage size of a single primary shard required to roll over (e.g., "30gb")' },
      { name: 'min_doc_count', type: 'number', required: false, description: 'Minimum number of documents required to roll over' },
      { name: 'min_index_age', type: 'string', required: false, description: 'Minimum age of the index required to roll over (e.g., "7d", "5d")' },
      { name: 'copy_alias', type: 'boolean', required: false, description: 'Controls whether to copy all aliases from current index to newly created index', default: 'false' },
    ],
    example: `{
  "rollover": {
    "min_size": "50gb",
    "min_primary_shard_size": "30gb",
    "min_doc_count": 1000000,
    "min_index_age": "7d",
    "copy_alias": true
  }
}`,
  },
  {
    name: 'delete',
    description: 'Deletes the index. This is typically used as the final action in a policy lifecycle.',
    parameters: [],
    example: `{
  "delete": {}
}`,
  },
  {
    name: 'read_only',
    description: 'Sets the index to read-only mode. No new documents can be indexed.',
    parameters: [],
    example: `{
  "read_only": {}
}`,
  },
  {
    name: 'read_write',
    description: 'Sets the index back to read-write mode, allowing new documents to be indexed.',
    parameters: [],
    example: `{
  "read_write": {}
}`,
  },
  {
    name: 'replica_count',
    description: 'Changes the number of replica shards for the index.',
    parameters: [
      { name: 'number_of_replicas', type: 'number', required: true, description: 'The new number of replica shards' },
    ],
    example: `{
  "replica_count": {
    "number_of_replicas": 1
  }
}`,
  },
  {
    name: 'force_merge',
    description: 'Force merges the index segments to reduce the number of Lucene segments. This operation attempts to set the index to read-only before starting the merge process. Improves search performance but is resource-intensive.',
    parameters: [
      { name: 'max_num_segments', type: 'number', required: true, description: 'Maximum number of segments to merge to' },
      { name: 'wait_for_completion', type: 'boolean', required: false, description: 'When false, request returns immediately. Use Tasks API to monitor status', default: 'true' },
      { name: 'task_execution_timeout', type: 'string', required: false, description: 'Explicit task execution timeout. Only useful when wait_for_completion is false', default: '1h' },
    ],
    example: `{
  "force_merge": {
    "max_num_segments": 1,
    "wait_for_completion": true
  }
}`,
  },
  {
    name: 'shrink',
    description: 'Shrinks the index to a smaller number of primary shards. The index must be read-only first. You must specify exactly one of: num_new_shards, max_shard_size, or percentage_of_source_shards.',
    parameters: [
      { name: 'num_new_shards', type: 'number', required: false, description: 'Target number of primary shards. Cannot be used with max_shard_size or percentage_of_source_shards' },
      { name: 'max_shard_size', type: 'string', required: false, description: 'Maximum size in bytes of a shard for target index (e.g., "5gb"). Cannot be used with num_new_shards or percentage_of_source_shards' },
      { name: 'percentage_of_source_shards', type: 'number', required: false, description: 'Percentage of original primary shards to keep (between 0.0 and 1.0, exclusive). Cannot be used with num_new_shards or max_shard_size' },
      { name: 'target_index_name_template', type: 'string', required: false, description: 'Template for the new index name. Supports {{ctx.index}} and {{ctx.indexUuid}} variables' },
      { name: 'aliases', type: 'array', required: false, description: 'Array of alias objects to add to the new index' },
      { name: 'switch_aliases', type: 'boolean', required: false, description: 'If true, copies aliases from source index to target index', default: 'false' },
      { name: 'force_unsafe', type: 'boolean', required: false, description: 'Force shrink even if index has no replicas', default: 'false' },
    ],
    example: `{
  "shrink": {
    "num_new_shards": 1,
    "target_index_name_template": {
      "source": "{{ctx.index}}_shrunken"
    },
    "switch_aliases": true
  }
}`,
  },
  {
    name: 'snapshot',
    description: 'Takes a snapshot of the index to a repository for backup purposes.',
    parameters: [
      { name: 'repository', type: 'string', required: true, description: 'Name of the snapshot repository registered through native snapshot API' },
      { name: 'snapshot', type: 'string', required: true, description: 'Name of the snapshot. Supports {{ctx.index}} and {{ctx.indexUuid}} Mustache variables' },
    ],
    example: `{
  "snapshot": {
    "repository": "my-s3-repo",
    "snapshot": "{{ctx.index}}-{{ctx.indexUuid}}"
  }
}`,
  },
  {
    name: 'close',
    description: 'Closes the managed index. Closed indexes remain on disk but consume no CPU or memory. You cannot read from, write to, or search closed indexes. Useful for retaining data longer than needed for active search.',
    parameters: [],
    example: `{
  "close": {}
}`,
  },
  {
    name: 'open',
    description: 'Opens a managed index that was previously closed. Reopening a closed index is simpler than restoring from a snapshot.',
    parameters: [],
    example: `{
  "open": {}
}`,
  },
  {
    name: 'convert_index_to_remote',
    description: 'Converts an index from a local snapshot repository to a remote repository. The repository name must match the one used in the snapshot action.',
    parameters: [
      { name: 'repository', type: 'string', required: true, description: 'Repository name registered through native snapshot API operations' },
      { name: 'snapshot', type: 'string', required: true, description: 'Snapshot name created through the snapshot action. Can use {{ctx.index}} variable' },
    ],
    example: `{
  "convert_index_to_remote": {
    "repository": "my-remote-repo",
    "snapshot": "{{ctx.index}}"
  }
}`,
  },
  {
    name: 'rollup',
    description: 'Periodically reduces data granularity by rolling up old data into summarized indexes. Rollup jobs created via ISM can only be non-continuous.',
    parameters: [
      { name: 'ism_rollup', type: 'object', required: true, description: 'Rollup configuration object containing target_index, dimensions, and metrics' },
    ],
    example: `{
  "rollup": {
    "ism_rollup": {
      "description": "Creating rollup through ISM",
      "target_index": "target",
      "page_size": 1000,
      "dimensions": [
        {
          "date_histogram": {
            "fixed_interval": "60m",
            "source_field": "timestamp",
            "target_field": "timestamp"
          }
        }
      ],
      "metrics": [
        {
          "source_field": "value",
          "metrics": [{ "sum": {} }, { "avg": {} }]
        }
      ]
    }
  }
}`,
  },
  {
    name: 'stop_replication',
    description: 'Stops replication and converts the follower index to a regular index. Use this before performing write operations on replicated indexes. Requires indices:internal/plugins/replication/index/stop permission if security is enabled.',
    parameters: [],
    example: `{
  "stop_replication": {}
}`,
  },
  {
    name: 'index_priority',
    description: 'Sets the recovery priority for the index. Higher priority indices are recovered first after a cluster restart.',
    parameters: [
      { name: 'priority', type: 'number', required: true, description: 'Recovery priority (higher = recovered first)' },
    ],
    example: `{
  "index_priority": {
    "priority": 100
  }
}`,
  },
  {
    name: 'allocation',
    description: 'Configures shard allocation rules for the index. Used to move data between hot/warm/cold tiers.',
    parameters: [
      { name: 'require', type: 'object', required: false, description: 'Node attributes that shards must be allocated to' },
      { name: 'include', type: 'object', required: false, description: 'Node attributes that shards can be allocated to' },
      { name: 'exclude', type: 'object', required: false, description: 'Node attributes that shards cannot be allocated to' },
      { name: 'wait_for', type: 'boolean', required: false, description: 'Wait for allocation to complete', default: 'false' },
    ],
    example: `{
  "allocation": {
    "require": {
      "box_type": "warm"
    },
    "wait_for": true
  }
}`,
  },
  {
    name: 'notification',
    description: 'Sends a notification when the action is executed. Supports Slack, Chime, and custom webhooks.',
    parameters: [
      { name: 'destination', type: 'object', required: true, description: 'Notification destination (slack, chime, or custom_webhook)' },
      { name: 'message_template', type: 'object', required: true, description: 'Message template with source and optional lang' },
    ],
    example: `{
  "notification": {
    "destination": {
      "slack": {
        "url": "https://hooks.slack.com/services/xxx"
      }
    },
    "message_template": {
      "source": "Index {{ctx.index}} has transitioned to {{ctx.state}}"
    }
  }
}`,
  },
  {
    name: 'warm_migration',
    description: 'Migrates the index to the warm tier in OpenSearch Serverless or managed service.',
    parameters: [],
    example: `{
  "warm_migration": {}
}`,
  },
  {
    name: 'cold_migration',
    description: 'Migrates the index to the cold tier for long-term, infrequent access storage.',
    parameters: [],
    example: `{
  "cold_migration": {}
}`,
  },
  {
    name: 'cold_delete',
    description: 'Deletes the index from cold storage.',
    parameters: [],
    example: `{
  "cold_delete": {}
}`,
  },
];

/**
 * Complete documentation for all transition conditions
 */
export const CONDITION_REFERENCE: ConditionReference[] = [
  {
    name: 'min_index_age',
    description: 'Triggers when the index reaches a minimum age since creation.',
    valueType: 'string (time duration)',
    example: '"min_index_age": "30d"',
  },
  {
    name: 'min_rollover_age',
    description: 'Triggers when the time since the last rollover reaches the specified duration.',
    valueType: 'string (time duration)',
    example: '"min_rollover_age": "7d"',
  },
  {
    name: 'min_state_age',
    description: 'Triggers when the index has spent at least the specified amount of time in the current state.',
    valueType: 'string (time duration)',
    example: '"min_state_age": "1d"',
  },
  {
    name: 'min_doc_count',
    description: 'Triggers when the index contains at least the specified number of documents.',
    valueType: 'number',
    example: '"min_doc_count": 1000000',
  },
  {
    name: 'min_size',
    description: 'Triggers when the total primary shard size (not counting replicas) reaches the specified value.',
    valueType: 'string (size)',
    example: '"min_size": "50gb"',
  },
  {
    name: 'no_alias',
    description: 'Controls transition based on alias presence. If true, transition occurs only when the index has no aliases. If false, transition occurs only when at least one alias exists.',
    valueType: 'boolean',
    example: '"no_alias": true',
  },
  {
    name: 'cron',
    description: 'Triggers based on a cron schedule. Useful for time-based transitions. Note: execution timing depends on job_interval setting.',
    valueType: 'object with cron expression and timezone',
    example: `"cron": {
  "cron": {
    "expression": "0 17 * * SAT",
    "timezone": "America/Los_Angeles"
  }
}`,
  },
];

/**
 * Get action reference by name
 */
export function getActionReference(name: string): ActionReference | undefined {
  return ACTION_REFERENCE.find(a => a.name === name);
}

/**
 * Get condition reference by name
 */
export function getConditionReference(name: string): ConditionReference | undefined {
  return CONDITION_REFERENCE.find(c => c.name === name);
}

/**
 * Search actions and conditions by query
 */
export function searchReference(query: string): {
  actions: ActionReference[];
  conditions: ConditionReference[];
} {
  const lowerQuery = query.toLowerCase();
  
  const actions = ACTION_REFERENCE.filter(
    a => a.name.toLowerCase().includes(lowerQuery) ||
         a.description.toLowerCase().includes(lowerQuery)
  );
  
  const conditions = CONDITION_REFERENCE.filter(
    c => c.name.toLowerCase().includes(lowerQuery) ||
         c.description.toLowerCase().includes(lowerQuery)
  );
  
  return { actions, conditions };
}

/**
 * Get all action names
 */
export function getAllActionNames(): string[] {
  return ACTION_REFERENCE.map(a => a.name);
}

/**
 * Get all condition names
 */
export function getAllConditionNames(): string[] {
  return CONDITION_REFERENCE.map(c => c.name);
}

/**
 * Format parameter documentation as a string
 */
export function formatParameterDoc(param: ParameterDoc): string {
  let doc = `${param.name} (${param.type})`;
  if (param.required) {
    doc += ' [required]';
  }
  doc += `: ${param.description}`;
  if (param.default) {
    doc += ` (default: ${param.default})`;
  }
  return doc;
}

/**
 * Get a brief description for an action
 */
export function getActionBrief(name: string): string {
  const action = getActionReference(name);
  if (!action) return name;
  
  // Return first sentence of description
  const firstSentence = action.description.split('.')[0];
  return firstSentence || action.description;
}

/**
 * Get a brief description for a condition
 */
export function getConditionBrief(name: string): string {
  const condition = getConditionReference(name);
  if (!condition) return name;
  
  const firstSentence = condition.description.split('.')[0];
  return firstSentence || condition.description;
}

/**
 * Time duration format help
 */
export const TIME_FORMAT_HELP = `
Time durations use the following format:
- s: seconds (e.g., "30s")
- m: minutes (e.g., "5m")
- h: hours (e.g., "2h")
- d: days (e.g., "30d")

Examples:
- "1d" = 1 day
- "7d" = 7 days
- "30d" = 30 days
- "90d" = 90 days
`;

/**
 * Size format help
 */
export const SIZE_FORMAT_HELP = `
Sizes use the following format:
- b: bytes (e.g., "1024b")
- kb: kilobytes (e.g., "100kb")
- mb: megabytes (e.g., "500mb")
- gb: gigabytes (e.g., "50gb")
- tb: terabytes (e.g., "1tb")

Examples:
- "50gb" = 50 gigabytes
- "100gb" = 100 gigabytes
- "1tb" = 1 terabyte
`;
