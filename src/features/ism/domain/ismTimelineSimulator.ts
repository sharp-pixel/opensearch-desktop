// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Timeline Simulator Service
 * Simulates ISM policy execution over time
 */

import type {
  ISMPolicy,
  ISMState,
  TransitionConditions,
  SimulationParams,
  TimelineData,
  TimelineEvent,
  IndexState,
} from '../../../types/ism';

/** Milliseconds per time unit */
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

/** Bytes per size unit */
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const BYTES_PER_GB = BYTES_PER_MB * 1024;
const BYTES_PER_TB = BYTES_PER_GB * 1024;

/**
 * Simulate timeline of ISM policy execution
 */
export function simulateTimeline(
  policy: ISMPolicy,
  params: SimulationParams
): TimelineData {
  const events: TimelineEvent[] = [];
  const { states, default_state } = policy.policy;
  
  // Find the default state
  const initialState = states.find(s => s.name === default_state);
  if (!initialState) {
    return {
      events: [],
      totalDuration: 0,
      finalState: default_state,
    };
  }

  // Initialize index state
  const indexState: IndexState = {
    age: 0,
    size: params.initialSize,
    docCount: params.initialDocCount,
    creationDate: params.creationDate,
  };

  const maxDuration = params.simulationDays * MS_PER_DAY;
  const timeStep = MS_PER_DAY; // Check conditions daily
  let currentTime = 0;
  let currentStateName = default_state;
  const visitedAtCurrentTime = new Set<string>();
  let steps = 0;
  let warning: string | undefined;

  // Add initial state entry
  events.push({
    timestamp: new Date(params.creationDate.getTime()),
    fromState: '',
    toState: default_state,
    triggeredBy: 'Policy attached',
    actions: getActionNames(initialState),
    indexAge: formatTimeValue(0),
    estimatedSize: formatSizeValue(params.initialSize),
    estimatedDocCount: params.initialDocCount,
  });

  // Simulate time progression
  while (currentTime < maxDuration) {
    if (visitedAtCurrentTime.has(currentStateName)) {
      warning = `Simulation stopped: transitions revisit "${currentStateName}" without advancing time.`;
      break;
    }
    if (++steps > 10000) {
      warning = 'Simulation stopped after 10,000 steps. Reduce the simulation duration.';
      break;
    }
    visitedAtCurrentTime.add(currentStateName);
    const currentState = states.find(s => s.name === currentStateName);
    if (!currentState) break;

    // Update index state based on growth rates
    indexState.age = currentTime;
    indexState.size = params.initialSize + (currentTime / MS_PER_DAY) * params.sizeGrowthRate;
    indexState.docCount = params.initialDocCount + Math.floor((currentTime / MS_PER_DAY) * params.docGrowthRate);

    // Check transitions
    if (!currentState.transitions || currentState.transitions.length === 0) {
      // No transitions - terminal state
      break;
    }

    let transitioned = false;
    for (let i = 0; i < currentState.transitions.length; i++) {
      const transition = currentState.transitions[i];
      if (!transition) continue;
      
      if (evaluateTransitionConditions(transition.conditions, indexState)) {
        // Find the target state
        const targetState = states.find(s => s.name === transition.state_name);
        
        if (targetState) {
          // Record the transition event
          events.push({
            timestamp: new Date(params.creationDate.getTime() + currentTime),
            fromState: currentStateName,
            toState: transition.state_name,
            triggeredBy: formatTrigger(transition.conditions),
            actions: getActionNames(targetState),
            indexAge: formatTimeValue(currentTime),
            estimatedSize: formatSizeValue(indexState.size),
            estimatedDocCount: indexState.docCount,
          });

          currentStateName = transition.state_name;
          transitioned = true;

          // Check if we've reached a terminal state
          if (isTerminalState(targetState)) {
            return {
              events,
              totalDuration: currentTime,
              finalState: targetState.name,
            };
          }

          break; // Only process one transition per time step
        }
      }
    }
    
    if (!transitioned) {
      currentTime += timeStep;
      visitedAtCurrentTime.clear();
    }
  }

  return {
    events,
    totalDuration: currentTime,
    finalState: currentStateName,
    warning,
  };
}

/**
 * Evaluate if transition conditions are met
 */
export function evaluateTransitionConditions(
  conditions: TransitionConditions | undefined,
  indexState: IndexState
): boolean {
  // No conditions means immediate transition
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }

  // Check min_index_age
  if (conditions.min_index_age) {
    const requiredAge = parseTimeValue(conditions.min_index_age);
    if (indexState.age < requiredAge) {
      return false;
    }
  }

  // Check min_doc_count
  if (conditions.min_doc_count !== undefined) {
    if (indexState.docCount < conditions.min_doc_count) {
      return false;
    }
  }

  // Check min_size
  if (conditions.min_size) {
    const requiredSize = parseSizeValue(conditions.min_size);
    if (indexState.size < requiredSize) {
      return false;
    }
  }

  // Check min_rollover_age
  if (conditions.min_rollover_age && indexState.rolloverAge !== undefined) {
    const requiredAge = parseTimeValue(conditions.min_rollover_age);
    if (indexState.rolloverAge < requiredAge) {
      return false;
    }
  }

  // Cron conditions are not simulated (would require specific time matching)
  // For simulation purposes, we skip cron conditions

  return true;
}

/**
 * Parse ISM time value string to milliseconds
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
export function parseTimeValue(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
  if (!match || !match[1] || !match[2]) {
    return 0;
  }

  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return num * MS_PER_SECOND;
    case 'm':
      return num * MS_PER_MINUTE;
    case 'h':
      return num * MS_PER_HOUR;
    case 'd':
      return num * MS_PER_DAY;
    default:
      return 0;
  }
}

/**
 * Parse ISM size value string to bytes
 * Supports: b (bytes), kb, mb, gb, tb
 */
export function parseSizeValue(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)$/i);
  if (!match || !match[1] || !match[2]) {
    return 0;
  }

  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'b':
      return num;
    case 'kb':
      return num * BYTES_PER_KB;
    case 'mb':
      return num * BYTES_PER_MB;
    case 'gb':
      return num * BYTES_PER_GB;
    case 'tb':
      return num * BYTES_PER_TB;
    default:
      return 0;
  }
}

/**
 * Format milliseconds as a human-readable time string
 */
export function formatTimeValue(ms: number): string {
  if (ms < MS_PER_MINUTE) {
    return `${Math.round(ms / MS_PER_SECOND)}s`;
  }
  if (ms < MS_PER_HOUR) {
    return `${Math.round(ms / MS_PER_MINUTE)}m`;
  }
  if (ms < MS_PER_DAY) {
    return `${Math.round(ms / MS_PER_HOUR)}h`;
  }
  return `${Math.round(ms / MS_PER_DAY)}d`;
}

/**
 * Format bytes as a human-readable size string
 */
export function formatSizeValue(bytes: number): string {
  if (bytes < BYTES_PER_KB) {
    return `${Math.round(bytes)}b`;
  }
  if (bytes < BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_KB).toFixed(1)}kb`;
  }
  if (bytes < BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_MB).toFixed(1)}mb`;
  }
  if (bytes < BYTES_PER_TB) {
    return `${(bytes / BYTES_PER_GB).toFixed(1)}gb`;
  }
  return `${(bytes / BYTES_PER_TB).toFixed(1)}tb`;
}

/**
 * Get action names from a state
 */
function getActionNames(state: ISMState): string[] {
  if (!state.actions) return [];
  
  return state.actions.map(action => {
    const keys = Object.keys(action).filter(k => k !== 'timeout' && k !== 'retry');
    return keys[0] || 'unknown';
  });
}

/**
 * Format transition trigger description
 */
function formatTrigger(conditions: TransitionConditions | undefined): string {
  if (!conditions || Object.keys(conditions).length === 0) {
    return 'Immediate transition';
  }

  const parts: string[] = [];

  if (conditions.min_index_age) {
    parts.push(`Index age ≥ ${conditions.min_index_age}`);
  }

  if (conditions.min_doc_count !== undefined) {
    parts.push(`Doc count ≥ ${conditions.min_doc_count.toLocaleString()}`);
  }

  if (conditions.min_size) {
    parts.push(`Size ≥ ${conditions.min_size}`);
  }

  if (conditions.min_rollover_age) {
    parts.push(`Rollover age ≥ ${conditions.min_rollover_age}`);
  }

  if (conditions.cron) {
    parts.push(`Cron: ${conditions.cron.cron.expression}`);
  }

  return parts.join(', ');
}

/**
 * Check if a state is terminal
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
 * Create default simulation parameters
 */
export function createDefaultSimulationParams(): SimulationParams {
  return {
    creationDate: new Date(),
    initialSize: 100 * BYTES_PER_MB, // 100 MB
    sizeGrowthRate: 10 * BYTES_PER_MB, // 10 MB per day
    initialDocCount: 10000,
    docGrowthRate: 1000, // 1000 docs per day
    simulationDays: 120,
  };
}

/**
 * Estimate when a transition will occur based on conditions
 */
export function estimateTransitionTime(
  conditions: TransitionConditions | undefined,
  params: SimulationParams
): number | null {
  if (!conditions || Object.keys(conditions).length === 0) {
    return 0; // Immediate
  }

  let maxTime = 0;

  // Estimate based on min_index_age
  if (conditions.min_index_age) {
    const requiredAge = parseTimeValue(conditions.min_index_age);
    maxTime = Math.max(maxTime, requiredAge);
  }

  // Estimate based on min_doc_count
  if (conditions.min_doc_count !== undefined && params.docGrowthRate > 0) {
    const docsNeeded = conditions.min_doc_count - params.initialDocCount;
    if (docsNeeded > 0) {
      const daysNeeded = docsNeeded / params.docGrowthRate;
      maxTime = Math.max(maxTime, daysNeeded * MS_PER_DAY);
    }
  }

  // Estimate based on min_size
  if (conditions.min_size && params.sizeGrowthRate > 0) {
    const requiredSize = parseSizeValue(conditions.min_size);
    const sizeNeeded = requiredSize - params.initialSize;
    if (sizeNeeded > 0) {
      const daysNeeded = sizeNeeded / params.sizeGrowthRate;
      maxTime = Math.max(maxTime, daysNeeded * MS_PER_DAY);
    }
  }

  // Cron conditions cannot be estimated
  if (conditions.cron) {
    return null;
  }

  return maxTime;
}
