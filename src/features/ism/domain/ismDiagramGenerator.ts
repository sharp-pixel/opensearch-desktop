// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Diagram Generator Service
 * Converts ISM policies to diagram data structures for visualization
 */

import type {
  ISMPolicy,
  ISMState,
  ISMAction,
  TransitionConditions,
  DiagramData,
  DiagramNode,
  DiagramEdge,
  ActionSummary,
  ConditionSummary,
} from '../../../types/ism';

/**
 * Generate diagram data from an ISM policy
 */
export function generateDiagramData(policy: ISMPolicy): DiagramData {
  const { states, default_state } = policy.policy;

  const nodes: DiagramNode[] = states.map(state => ({
    id: state.name,
    name: state.name,
    actions: state.actions?.map(formatActionSummary) || [],
    isDefault: state.name === default_state,
    isTerminal: isTerminalState(state),
    stateType: classifyStateType(state, policy),
  }));

  const edges: DiagramEdge[] = [];
  states.forEach(state => {
    if (state.transitions) {
      state.transitions.forEach(transition => {
        edges.push({
          source: state.name,
          target: transition.state_name,
          conditions: transition.conditions 
            ? formatConditions(transition.conditions)
            : [],
          hasConditions: !!transition.conditions && Object.keys(transition.conditions).length > 0,
        });
      });
    }
  });

  return {
    nodes,
    edges,
    defaultState: default_state,
  };
}

/**
 * Classify the type of a state for visualization
 */
export function classifyStateType(
  state: ISMState,
  policy: ISMPolicy
): 'normal' | 'terminal' | 'default' | 'warning' {
  const { default_state } = policy.policy;

  // Check if it's the default state
  if (state.name === default_state) {
    return 'default';
  }

  // Check if it's a terminal state (has delete action or no transitions)
  if (isTerminalState(state)) {
    return 'terminal';
  }

  // Check for warning conditions (no actions)
  if (!state.actions || state.actions.length === 0) {
    return 'warning';
  }

  return 'normal';
}

/**
 * Check if a state is terminal (has delete action or no outgoing transitions)
 */
function isTerminalState(state: ISMState): boolean {
  // Check for delete action
  if (state.actions) {
    for (const action of state.actions) {
      if ('delete' in action) {
        return true;
      }
    }
  }

  // Check for no outgoing transitions
  return !state.transitions || state.transitions.length === 0;
}

/**
 * Format transition conditions as a label string
 */
export function formatConditionLabel(conditions: TransitionConditions): string {
  const parts: string[] = [];

  if (conditions.min_index_age) {
    parts.push(`age ≥ ${conditions.min_index_age}`);
  }

  if (conditions.min_doc_count !== undefined) {
    parts.push(`docs ≥ ${formatNumber(conditions.min_doc_count)}`);
  }

  if (conditions.min_size) {
    parts.push(`size ≥ ${conditions.min_size}`);
  }

  if (conditions.min_rollover_age) {
    parts.push(`rollover age ≥ ${conditions.min_rollover_age}`);
  }

  if (conditions.cron) {
    parts.push(`cron: ${conditions.cron.cron.expression}`);
  }

  return parts.join(', ') || 'immediate';
}

/**
 * Format conditions as an array of summaries
 */
function formatConditions(conditions: TransitionConditions): ConditionSummary[] {
  const summaries: ConditionSummary[] = [];

  if (conditions.min_index_age) {
    summaries.push({
      type: 'min_index_age',
      value: conditions.min_index_age,
    });
  }

  if (conditions.min_doc_count !== undefined) {
    summaries.push({
      type: 'min_doc_count',
      value: formatNumber(conditions.min_doc_count),
    });
  }

  if (conditions.min_size) {
    summaries.push({
      type: 'min_size',
      value: conditions.min_size,
    });
  }

  if (conditions.min_rollover_age) {
    summaries.push({
      type: 'min_rollover_age',
      value: conditions.min_rollover_age,
    });
  }

  if (conditions.cron) {
    summaries.push({
      type: 'cron',
      value: conditions.cron.cron.expression,
    });
  }

  return summaries;
}

/**
 * Format an action as a summary for display
 */
export function formatActionSummary(action: ISMAction): ActionSummary {
  // Find the action type (excluding timeout and retry)
  const actionKeys = Object.keys(action).filter(k => k !== 'timeout' && k !== 'retry');
  
  if (actionKeys.length === 0) {
    return { type: 'unknown' };
  }

  const actionType = actionKeys[0] as keyof ISMAction;
  const actionConfig = action[actionType];

  // Format based on action type
  switch (actionType) {
    case 'rollover':
      return {
        type: 'rollover',
        params: actionConfig as Record<string, unknown>,
      };

    case 'delete':
      return { type: 'delete' };

    case 'read_only':
      return { type: 'read_only' };

    case 'read_write':
      return { type: 'read_write' };

    case 'replica_count':
      return {
        type: 'replica_count',
        params: actionConfig as Record<string, unknown>,
      };

    case 'force_merge':
      return {
        type: 'force_merge',
        params: actionConfig as Record<string, unknown>,
      };

    case 'shrink':
      return {
        type: 'shrink',
        params: actionConfig as Record<string, unknown>,
      };

    case 'snapshot':
      return {
        type: 'snapshot',
        params: actionConfig as Record<string, unknown>,
      };

    case 'index_priority':
      return {
        type: 'index_priority',
        params: actionConfig as Record<string, unknown>,
      };

    case 'allocation':
      return {
        type: 'allocation',
        params: actionConfig as Record<string, unknown>,
      };

    case 'notification':
      return { type: 'notification' };

    case 'warm_migration':
      return { type: 'warm_migration' };

    case 'cold_migration':
      return { type: 'cold_migration' };

    case 'cold_delete':
      return { type: 'cold_delete' };

    default:
      return { type: actionType };
  }
}

/**
 * Format a number with thousands separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get a human-readable label for an action type
 */
export function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    rollover: 'Rollover',
    delete: 'Delete',
    read_only: 'Read Only',
    read_write: 'Read/Write',
    replica_count: 'Set Replicas',
    force_merge: 'Force Merge',
    shrink: 'Shrink',
    snapshot: 'Snapshot',
    index_priority: 'Set Priority',
    allocation: 'Allocation',
    notification: 'Notify',
    warm_migration: 'Warm Migration',
    cold_migration: 'Cold Migration',
    cold_delete: 'Cold Delete',
  };

  return labels[actionType] || actionType;
}

/**
 * Get a color for a state type
 */
export function getStateColor(stateType: 'normal' | 'terminal' | 'default' | 'warning'): string {
  const colors: Record<string, string> = {
    default: '#3b82f6', // blue
    terminal: '#ef4444', // red
    normal: '#6b7280', // gray
    warning: '#f59e0b', // amber
  };

  return colors[stateType] ?? colors.normal ?? '#6b7280';
}

/**
 * Calculate layout positions for states using a simple force-directed approach
 * Returns positions as percentages for responsive layout
 */
export function calculateStatePositions(
  data: DiagramData
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeCount = data.nodes.length;

  if (nodeCount === 0) {
    return positions;
  }

  // Simple layout: arrange in a horizontal line with default state first
  const sortedNodes = [...data.nodes].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    if (a.isTerminal) return 1;
    if (b.isTerminal) return -1;
    return 0;
  });

  const spacing = 100 / (nodeCount + 1);
  
  sortedNodes.forEach((node, index) => {
    positions.set(node.id, {
      x: spacing * (index + 1),
      y: 50, // Center vertically
    });
  });

  return positions;
}

/**
 * Format action summary as a display string
 */
export function formatActionDisplay(action: ActionSummary): string {
  const label = getActionLabel(action.type);
  
  if (!action.params || Object.keys(action.params).length === 0) {
    return label;
  }

  // Format key parameters
  const paramParts: string[] = [];
  
  if ('number_of_replicas' in action.params) {
    paramParts.push(`${action.params.number_of_replicas} replicas`);
  }
  
  if ('max_num_segments' in action.params) {
    paramParts.push(`${action.params.max_num_segments} segments`);
  }
  
  if ('min_index_age' in action.params) {
    paramParts.push(`age: ${action.params.min_index_age}`);
  }
  
  if ('min_size' in action.params) {
    paramParts.push(`size: ${action.params.min_size}`);
  }
  
  if ('repository' in action.params) {
    paramParts.push(`repo: ${action.params.repository}`);
  }
  
  if ('priority' in action.params) {
    paramParts.push(`priority: ${action.params.priority}`);
  }

  if (paramParts.length > 0) {
    return `${label} (${paramParts.join(', ')})`;
  }

  return label;
}
