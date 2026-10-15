// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Policy Validator Service
 * Validates ISM policy JSON syntax and schema structure
 */

import type { ISMPolicy, ValidationError, ValidationResult } from '../../../types/ism';

/** Valid ISM action types */
const VALID_ACTION_TYPES = [
  'rollover',
  'delete',
  'read_only',
  'read_write',
  'replica_count',
  'force_merge',
  'shrink',
  'snapshot',
  'index_priority',
  'allocation',
  'notification',
  'warm_migration',
  'cold_migration',
  'cold_delete',
  'timeout',
  'retry',
];

/** Valid transition condition types */
const VALID_CONDITION_TYPES = [
  'min_index_age',
  'min_doc_count',
  'min_size',
  'min_rollover_age',
  'cron',
];

/**
 * Validate JSON syntax and return parse result or errors
 */
export function validatePolicyJson(json: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!json.trim()) {
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        message: 'Policy JSON is empty',
        severity: 'error',
      }],
    };
  }

  try {
    const parsed = JSON.parse(json);
    
    // Validate schema structure
    const schemaErrors = validatePolicySchema(parsed);
    if (schemaErrors.length > 0) {
      return {
        valid: false,
        errors: schemaErrors.map(err => ({
          ...err,
          ...getErrorLocation(json, err.path || ''),
        })),
      };
    }

    return { valid: true, errors: [] };
  } catch (e) {
    const error = e as SyntaxError;
    const location = parseJsonErrorLocation(error.message, json);
    
    errors.push({
      line: location.line,
      column: location.column,
      message: `JSON syntax error: ${error.message}`,
      severity: 'error',
    });

    return { valid: false, errors };
  }
}

/**
 * Validate ISM policy schema structure
 */
export function validatePolicySchema(policy: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check root structure
  if (!policy || typeof policy !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: 'Policy must be an object',
      severity: 'error',
      path: '',
    });
    return errors;
  }

  const policyObj = policy as Record<string, unknown>;

  // Check for 'policy' wrapper
  if (!('policy' in policyObj)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Missing required "policy" field',
      severity: 'error',
      path: '',
    });
    return errors;
  }

  const innerPolicy = policyObj.policy as Record<string, unknown>;

  if (!innerPolicy || typeof innerPolicy !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: '"policy" must be an object',
      severity: 'error',
      path: 'policy',
    });
    return errors;
  }

  // Check for required default_state
  if (!('default_state' in innerPolicy)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Missing required "default_state" field',
      severity: 'error',
      path: 'policy.default_state',
    });
  } else if (typeof innerPolicy.default_state !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: '"default_state" must be a string',
      severity: 'error',
      path: 'policy.default_state',
    });
  }

  // Check for required states array
  if (!('states' in innerPolicy)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Missing required "states" array',
      severity: 'error',
      path: 'policy.states',
    });
    return errors;
  }

  if (!Array.isArray(innerPolicy.states)) {
    errors.push({
      line: 1,
      column: 1,
      message: '"states" must be an array',
      severity: 'error',
      path: 'policy.states',
    });
    return errors;
  }

  if (innerPolicy.states.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message: '"states" array cannot be empty',
      severity: 'error',
      path: 'policy.states',
    });
    return errors;
  }

  // Collect state names for reference validation
  const stateNames = new Set<string>();

  // Validate each state
  innerPolicy.states.forEach((state, index) => {
    const statePath = `policy.states[${index}]`;
    const stateErrors = validateState(state, statePath);
    errors.push(...stateErrors);

    if (state && typeof state === 'object' && 'name' in state) {
      const stateName = (state as Record<string, unknown>).name;
      if (typeof stateName === 'string') {
        if (stateNames.has(stateName)) {
          errors.push({
            line: 1,
            column: 1,
            message: `Duplicate state name: "${stateName}"`,
            severity: 'error',
            path: `${statePath}.name`,
          });
        }
        stateNames.add(stateName);
      }
    }
  });

  // Validate default_state references an existing state
  if (typeof innerPolicy.default_state === 'string' && !stateNames.has(innerPolicy.default_state)) {
    errors.push({
      line: 1,
      column: 1,
      message: `default_state "${innerPolicy.default_state}" does not match any defined state`,
      severity: 'error',
      path: 'policy.default_state',
    });
  }

  // Validate transition state references
  innerPolicy.states.forEach((state, index) => {
    if (state && typeof state === 'object') {
      const stateObj = state as Record<string, unknown>;
      if (Array.isArray(stateObj.transitions)) {
        stateObj.transitions.forEach((transition, tIndex) => {
          if (transition && typeof transition === 'object') {
            const transObj = transition as Record<string, unknown>;
            if (typeof transObj.state_name === 'string' && !stateNames.has(transObj.state_name)) {
              errors.push({
                line: 1,
                column: 1,
                message: `Transition references non-existent state: "${transObj.state_name}"`,
                severity: 'error',
                path: `policy.states[${index}].transitions[${tIndex}].state_name`,
              });
            }
          }
        });
      }
    }
  });

  // Validate ism_template if present
  if ('ism_template' in innerPolicy && innerPolicy.ism_template !== undefined) {
    if (!Array.isArray(innerPolicy.ism_template)) {
      errors.push({
        line: 1,
        column: 1,
        message: '"ism_template" must be an array',
        severity: 'error',
        path: 'policy.ism_template',
      });
    } else {
      innerPolicy.ism_template.forEach((template, index) => {
        const templateErrors = validateTemplate(template, `policy.ism_template[${index}]`);
        errors.push(...templateErrors);
      });
    }
  }

  return errors;
}

/**
 * Validate a single state object
 */
function validateState(state: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!state || typeof state !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: 'State must be an object',
      severity: 'error',
      path,
    });
    return errors;
  }

  const stateObj = state as Record<string, unknown>;

  // Check required name field
  if (!('name' in stateObj)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'State missing required "name" field',
      severity: 'error',
      path: `${path}.name`,
    });
  } else if (typeof stateObj.name !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: 'State "name" must be a string',
      severity: 'error',
      path: `${path}.name`,
    });
  } else if (!stateObj.name.trim()) {
    errors.push({
      line: 1,
      column: 1,
      message: 'State "name" cannot be empty',
      severity: 'error',
      path: `${path}.name`,
    });
  }

  // Validate actions if present
  if ('actions' in stateObj && stateObj.actions !== undefined) {
    if (!Array.isArray(stateObj.actions)) {
      errors.push({
        line: 1,
        column: 1,
        message: 'State "actions" must be an array',
        severity: 'error',
        path: `${path}.actions`,
      });
    } else {
      stateObj.actions.forEach((action, index) => {
        const actionErrors = validateAction(action, `${path}.actions[${index}]`);
        errors.push(...actionErrors);
      });
    }
  }

  // Validate transitions if present
  if ('transitions' in stateObj && stateObj.transitions !== undefined) {
    if (!Array.isArray(stateObj.transitions)) {
      errors.push({
        line: 1,
        column: 1,
        message: 'State "transitions" must be an array',
        severity: 'error',
        path: `${path}.transitions`,
      });
    } else {
      stateObj.transitions.forEach((transition, index) => {
        const transitionErrors = validateTransition(transition, `${path}.transitions[${index}]`);
        errors.push(...transitionErrors);
      });
    }
  }

  return errors;
}

/**
 * Validate a single action object
 */
function validateAction(action: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!action || typeof action !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: 'Action must be an object',
      severity: 'error',
      path,
    });
    return errors;
  }

  const actionObj = action as Record<string, unknown>;
  const actionKeys = Object.keys(actionObj);

  // Check for at least one action type
  const actionTypes = actionKeys.filter(key => VALID_ACTION_TYPES.includes(key));
  
  if (actionTypes.length === 0) {
    // Check for unknown action types
    const unknownKeys = actionKeys.filter(key => !VALID_ACTION_TYPES.includes(key));
    if (unknownKeys.length > 0) {
      errors.push({
        line: 1,
        column: 1,
        message: `Unknown action type: "${unknownKeys[0]}"`,
        severity: 'error',
        path,
      });
    } else {
      errors.push({
        line: 1,
        column: 1,
        message: 'Action must contain at least one action type',
        severity: 'error',
        path,
      });
    }
  }

  // Validate specific action configurations
  if ('replica_count' in actionObj) {
    const replicaCount = actionObj.replica_count as Record<string, unknown>;
    if (replicaCount && typeof replicaCount === 'object') {
      if (!('number_of_replicas' in replicaCount)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'replica_count action requires "number_of_replicas" field',
          severity: 'error',
          path: `${path}.replica_count`,
        });
      } else if (typeof replicaCount.number_of_replicas !== 'number') {
        errors.push({
          line: 1,
          column: 1,
          message: '"number_of_replicas" must be a number',
          severity: 'error',
          path: `${path}.replica_count.number_of_replicas`,
        });
      }
    }
  }

  if ('force_merge' in actionObj) {
    const forceMerge = actionObj.force_merge as Record<string, unknown>;
    if (forceMerge && typeof forceMerge === 'object') {
      if (!('max_num_segments' in forceMerge)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'force_merge action requires "max_num_segments" field',
          severity: 'error',
          path: `${path}.force_merge`,
        });
      } else if (typeof forceMerge.max_num_segments !== 'number') {
        errors.push({
          line: 1,
          column: 1,
          message: '"max_num_segments" must be a number',
          severity: 'error',
          path: `${path}.force_merge.max_num_segments`,
        });
      }
    }
  }

  if ('snapshot' in actionObj) {
    const snapshot = actionObj.snapshot as Record<string, unknown>;
    if (snapshot && typeof snapshot === 'object') {
      if (!('repository' in snapshot)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'snapshot action requires "repository" field',
          severity: 'error',
          path: `${path}.snapshot`,
        });
      }
      if (!('snapshot' in snapshot)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'snapshot action requires "snapshot" field',
          severity: 'error',
          path: `${path}.snapshot`,
        });
      }
    }
  }

  if ('index_priority' in actionObj) {
    const indexPriority = actionObj.index_priority as Record<string, unknown>;
    if (indexPriority && typeof indexPriority === 'object') {
      if (!('priority' in indexPriority)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'index_priority action requires "priority" field',
          severity: 'error',
          path: `${path}.index_priority`,
        });
      } else if (typeof indexPriority.priority !== 'number') {
        errors.push({
          line: 1,
          column: 1,
          message: '"priority" must be a number',
          severity: 'error',
          path: `${path}.index_priority.priority`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate a single transition object
 */
function validateTransition(transition: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!transition || typeof transition !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: 'Transition must be an object',
      severity: 'error',
      path,
    });
    return errors;
  }

  const transObj = transition as Record<string, unknown>;

  // Check required state_name field
  if (!('state_name' in transObj)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Transition missing required "state_name" field',
      severity: 'error',
      path: `${path}.state_name`,
    });
  } else if (typeof transObj.state_name !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: 'Transition "state_name" must be a string',
      severity: 'error',
      path: `${path}.state_name`,
    });
  }

  // Validate conditions if present
  if ('conditions' in transObj && transObj.conditions !== undefined) {
    if (!transObj.conditions || typeof transObj.conditions !== 'object') {
      errors.push({
        line: 1,
        column: 1,
        message: 'Transition "conditions" must be an object',
        severity: 'error',
        path: `${path}.conditions`,
      });
    } else {
      const condErrors = validateConditions(transObj.conditions, `${path}.conditions`);
      errors.push(...condErrors);
    }
  }

  return errors;
}

/**
 * Validate transition conditions
 */
function validateConditions(conditions: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!conditions || typeof conditions !== 'object') {
    return errors;
  }

  const condObj = conditions as Record<string, unknown>;
  const condKeys = Object.keys(condObj);

  // Check for unknown condition types
  condKeys.forEach(key => {
    if (!VALID_CONDITION_TYPES.includes(key)) {
      errors.push({
        line: 1,
        column: 1,
        message: `Unknown condition type: "${key}"`,
        severity: 'warning',
        path: `${path}.${key}`,
      });
    }
  });

  // Validate specific condition types
  if ('min_index_age' in condObj && typeof condObj.min_index_age !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: '"min_index_age" must be a string (e.g., "30d")',
      severity: 'error',
      path: `${path}.min_index_age`,
    });
  }

  if ('min_doc_count' in condObj && typeof condObj.min_doc_count !== 'number') {
    errors.push({
      line: 1,
      column: 1,
      message: '"min_doc_count" must be a number',
      severity: 'error',
      path: `${path}.min_doc_count`,
    });
  }

  if ('min_size' in condObj && typeof condObj.min_size !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: '"min_size" must be a string (e.g., "50gb")',
      severity: 'error',
      path: `${path}.min_size`,
    });
  }

  if ('min_rollover_age' in condObj && typeof condObj.min_rollover_age !== 'string') {
    errors.push({
      line: 1,
      column: 1,
      message: '"min_rollover_age" must be a string (e.g., "7d")',
      severity: 'error',
      path: `${path}.min_rollover_age`,
    });
  }

  if ('cron' in condObj) {
    const cron = condObj.cron as Record<string, unknown>;
    if (!cron || typeof cron !== 'object' || !('cron' in cron)) {
      errors.push({
        line: 1,
        column: 1,
        message: '"cron" condition must have nested "cron" object with "expression" and "timezone"',
        severity: 'error',
        path: `${path}.cron`,
      });
    }
  }

  return errors;
}

/**
 * Validate ISM template
 */
function validateTemplate(template: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!template || typeof template !== 'object') {
    errors.push({
      line: 1,
      column: 1,
      message: 'ISM template must be an object',
      severity: 'error',
      path,
    });
    return errors;
  }

  const templateObj = template as Record<string, unknown>;

  if (!('index_patterns' in templateObj)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'ISM template missing required "index_patterns" field',
      severity: 'error',
      path: `${path}.index_patterns`,
    });
  } else if (!Array.isArray(templateObj.index_patterns)) {
    errors.push({
      line: 1,
      column: 1,
      message: '"index_patterns" must be an array',
      severity: 'error',
      path: `${path}.index_patterns`,
    });
  } else if (templateObj.index_patterns.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message: '"index_patterns" array cannot be empty',
      severity: 'error',
      path: `${path}.index_patterns`,
    });
  }

  if ('priority' in templateObj && typeof templateObj.priority !== 'number') {
    errors.push({
      line: 1,
      column: 1,
      message: '"priority" must be a number',
      severity: 'error',
      path: `${path}.priority`,
    });
  }

  return errors;
}

/**
 * Get line and column number for a JSON path
 */
export function getErrorLocation(json: string, path: string): { line: number; column: number } {
  if (!path) {
    return { line: 1, column: 1 };
  }

  const lines = json.split('\n');
  const pathParts = path.split('.');
  
  // Try to find the path in the JSON
  let searchKey = pathParts[pathParts.length - 1] || '';
  
  // Handle array indices
  const arrayMatch = searchKey.match(/^(\w+)\[(\d+)\]$/);
  if (arrayMatch && arrayMatch[1]) {
    searchKey = arrayMatch[1];
  }

  // Search for the key in the JSON
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line) {
      const keyIndex = line.indexOf(`"${searchKey}"`);
      if (keyIndex !== -1) {
        return { line: i + 1, column: keyIndex + 1 };
      }
    }
  }

  return { line: 1, column: 1 };
}

/**
 * Parse JSON error message to extract line and column
 */
function parseJsonErrorLocation(message: string, json: string): { line: number; column: number } {
  // Try to extract position from error message
  // Format varies: "at position X" or "at line X column Y"
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch && posMatch[1]) {
    const position = parseInt(posMatch[1], 10);
    return positionToLineColumn(json, position);
  }

  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch && lineColMatch[1] && lineColMatch[2]) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  return { line: 1, column: 1 };
}

/**
 * Convert character position to line and column
 */
function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Parse JSON and return the policy object or null
 */
export function parsePolicy(json: string): ISMPolicy | null {
  try {
    const parsed = JSON.parse(json);
    const result = validatePolicySchema(parsed);
    if (result.length === 0) {
      return parsed as ISMPolicy;
    }
    return null;
  } catch {
    return null;
  }
}
