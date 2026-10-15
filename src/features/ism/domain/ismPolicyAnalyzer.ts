// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Policy Analyzer Service
 * Analyzes ISM policies for structural issues and potential problems
 */

import type { ISMPolicy, ISMState, AnalysisResult } from '../../../types/ism';

/**
 * Analyze an ISM policy for potential issues
 * Returns a list of analysis results with severity levels
 */
export function analyzePolicy(policy: ISMPolicy): AnalysisResult[] {
  const results: AnalysisResult[] = [];

  // Run all analysis checks
  const unreachable = findUnreachableStates(policy);
  unreachable.forEach(stateName => {
    results.push({
      type: 'unreachable',
      severity: 'warning',
      message: `State "${stateName}" is unreachable`,
      stateName,
      details: 'This state has no incoming transitions and is not the default state. It will never be entered.',
    });
  });

  if (findMissingTerminalStates(policy)) {
    results.push({
      type: 'no-terminal',
      severity: 'warning',
      message: 'Policy has no terminal state',
      details: 'No state contains a delete action or has zero outgoing transitions. Indices may remain in the final state indefinitely.',
    });
  }

  const circular = findCircularTransitions(policy);
  circular.forEach(cycle => {
    results.push({
      type: 'circular',
      severity: 'info',
      message: `Circular transition detected: ${cycle.join(' → ')}`,
      stateName: cycle[0],
      details: 'This cycle may be intentional (e.g., for rollover patterns) but could also cause infinite loops.',
    });
  });

  const noActions = findStatesWithoutActions(policy);
  noActions.forEach(stateName => {
    results.push({
      type: 'no-actions',
      severity: 'info',
      message: `State "${stateName}" has no actions defined`,
      stateName,
      details: 'This state will not perform any operations on the index.',
    });
  });

  const noConditions = findTransitionsWithoutConditions(policy);
  noConditions.forEach(({ state, target }) => {
    results.push({
      type: 'no-conditions',
      severity: 'warning',
      message: `Transition from "${state}" to "${target}" has no conditions`,
      stateName: state,
      details: 'This transition will occur immediately after entering the state.',
    });
  });

  const invalidRefs = validateStateReferences(policy);
  invalidRefs.forEach(({ state, invalidRef }) => {
    results.push({
      type: 'invalid-ref',
      severity: 'error',
      message: `State "${state}" references non-existent state "${invalidRef}"`,
      stateName: state,
      details: 'The transition target state does not exist in the policy.',
    });
  });

  return results;
}

/**
 * Find states that are unreachable (no incoming transitions and not default)
 * A state is unreachable if:
 * - It is not the default state
 * - No other state has a transition to it
 */
export function findUnreachableStates(policy: ISMPolicy): string[] {
  const { states, default_state } = policy.policy;
  const unreachable: string[] = [];

  // Build set of all states that have incoming transitions
  const hasIncoming = new Set<string>();
  
  states.forEach(state => {
    if (state.transitions) {
      state.transitions.forEach(transition => {
        hasIncoming.add(transition.state_name);
      });
    }
  });

  // Find states with no incoming transitions (except default)
  states.forEach(state => {
    if (state.name !== default_state && !hasIncoming.has(state.name)) {
      unreachable.push(state.name);
    }
  });

  return unreachable;
}

/**
 * Check if policy is missing a terminal state
 * A terminal state is one that:
 * - Contains a delete action, OR
 * - Has no outgoing transitions
 */
export function findMissingTerminalStates(policy: ISMPolicy): boolean {
  const { states } = policy.policy;

  for (const state of states) {
    // Check for delete action
    if (state.actions) {
      for (const action of state.actions) {
        if ('delete' in action) {
          return false; // Found a terminal state with delete
        }
      }
    }

    // Check for no outgoing transitions
    if (!state.transitions || state.transitions.length === 0) {
      return false; // Found a terminal state with no transitions
    }
  }

  return true; // No terminal state found
}

/**
 * Find circular transitions (cycles) in the policy
 * Uses DFS to detect cycles
 */
export function findCircularTransitions(policy: ISMPolicy): string[][] {
  const { states } = policy.policy;
  const cycles: string[][] = [];
  
  // Build adjacency list
  const graph = new Map<string, string[]>();
  states.forEach(state => {
    const targets = state.transitions?.map(t => t.state_name) || [];
    graph.set(state.name, targets);
  });

  // Track visited states and current path
  const visited = new Set<string>();
  const inPath = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (inPath.has(node)) {
      // Found a cycle - extract it from the path
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      
      // Check if this cycle is already recorded (in any rotation)
      const cycleKey = [...cycle].sort().join(',');
      const isDuplicate = cycles.some(existing => {
        const existingKey = [...existing].sort().join(',');
        return existingKey === cycleKey;
      });
      
      if (!isDuplicate) {
        cycles.push(cycle);
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    inPath.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    path.pop();
    inPath.delete(node);
  }

  // Start DFS from each state
  for (const state of states) {
    visited.clear();
    inPath.clear();
    path.length = 0;
    dfs(state.name);
  }

  return cycles;
}

/**
 * Find states that have no actions defined
 */
export function findStatesWithoutActions(policy: ISMPolicy): string[] {
  const { states } = policy.policy;
  const noActions: string[] = [];

  states.forEach(state => {
    if (!state.actions || state.actions.length === 0) {
      noActions.push(state.name);
    }
  });

  return noActions;
}

/**
 * Find transitions that have no conditions (immediate transitions)
 */
export function findTransitionsWithoutConditions(policy: ISMPolicy): { state: string; target: string }[] {
  const { states } = policy.policy;
  const noConditions: { state: string; target: string }[] = [];

  states.forEach(state => {
    if (state.transitions) {
      state.transitions.forEach(transition => {
        if (!transition.conditions || Object.keys(transition.conditions).length === 0) {
          noConditions.push({
            state: state.name,
            target: transition.state_name,
          });
        }
      });
    }
  });

  return noConditions;
}

/**
 * Validate that all state references in transitions exist
 */
export function validateStateReferences(policy: ISMPolicy): { state: string; invalidRef: string }[] {
  const { states } = policy.policy;
  const invalidRefs: { state: string; invalidRef: string }[] = [];

  // Build set of valid state names
  const validStates = new Set(states.map(s => s.name));

  states.forEach(state => {
    if (state.transitions) {
      state.transitions.forEach(transition => {
        if (!validStates.has(transition.state_name)) {
          invalidRefs.push({
            state: state.name,
            invalidRef: transition.state_name,
          });
        }
      });
    }
  });

  return invalidRefs;
}

/**
 * Get all state names from a policy
 */
export function getStateNames(policy: ISMPolicy): string[] {
  return policy.policy.states.map(s => s.name);
}

/**
 * Get a state by name
 */
export function getStateByName(policy: ISMPolicy, name: string): ISMState | undefined {
  return policy.policy.states.find(s => s.name === name);
}

/**
 * Check if a state is a terminal state (has delete action or no transitions)
 */
export function isTerminalState(state: ISMState): boolean {
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
 * Get the action types present in a state
 */
export function getActionTypes(state: ISMState): string[] {
  if (!state.actions) return [];
  
  const types: string[] = [];
  state.actions.forEach(action => {
    const keys = Object.keys(action).filter(k => k !== 'timeout' && k !== 'retry');
    types.push(...keys);
  });
  
  return types;
}
