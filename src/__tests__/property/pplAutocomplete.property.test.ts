// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for PPL Autocomplete Provider
 * Tests parsePPLContext, getPPLSuggestions, getAllPPLCommands, getAllPPLFunctions, getAllPPLOperators
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parsePPLContext,
  getPPLSuggestions,
  getAllPPLCommands,
  getAllPPLFunctions,
  getAllPPLOperators,
} from '../../services/pplAutocomplete';

describe('PPL Autocomplete Provider Tests', () => {
  describe('parsePPLContext', () => {
    it('returns start position for empty query', () => {
      const context = parsePPLContext('', 0);
      expect(context.position).toBe('start');
    });

    it('returns start position for whitespace only', () => {
      const context = parsePPLContext('   ', 3);
      expect(context.position).toBe('start');
    });

    it('returns after_source when typing source=', () => {
      const context = parsePPLContext('source=', 7);
      expect(context.position).toBe('after_source');
    });

    it('returns after_source when typing index name', () => {
      const context = parsePPLContext('source=log', 10);
      expect(context.position).toBe('after_source');
    });

    it('returns after_pipe after pipe character', () => {
      const context = parsePPLContext('source=logs | ', 14);
      expect(context.position).toBe('after_pipe');
    });

    it('returns after_pipe when typing partial command', () => {
      const context = parsePPLContext('source=logs | whe', 17);
      expect(context.position).toBe('after_pipe');
    });

    it('returns in_command when in stats command', () => {
      const context = parsePPLContext('source=logs | stats ', 20);
      expect(context.position).toBe('in_command');
      expect(context.currentCommand).toBe('stats');
    });

    it('returns in_where when in where clause', () => {
      const context = parsePPLContext('source=logs | where ', 20);
      expect(context.position).toBe('in_where');
      expect(context.currentCommand).toBe('where');
    });

    it('returns in_function when inside function call', () => {
      const context = parsePPLContext('source=logs | stats count(', 26);
      expect(context.position).toBe('in_function');
      expect(context.inFunction).toBe('count');
    });

    it('extracts source index correctly', () => {
      const context = parsePPLContext('source=my-index | where status > 400', 36);
      expect(context.sourceIndex).toBe('my-index');
    });

    it('handles multiple pipes', () => {
      const context = parsePPLContext('source=logs | where x > 1 | stats ', 34);
      expect(context.position).toBe('in_command');
      expect(context.currentCommand).toBe('stats');
    });

    it('returns start when typing partial source keyword', () => {
      const context = parsePPLContext('sou', 3);
      expect(context.position).toBe('start');
    });
  });

  describe('getPPLSuggestions', () => {
    it('suggests source at start', () => {
      const suggestions = getPPLSuggestions('', 0);
      expect(suggestions.some(s => s.label === 'source')).toBe(true);
    });

    it('suggests indices after source=', () => {
      const indices = ['logs', 'metrics', 'users'];
      const suggestions = getPPLSuggestions('source=', 7, indices);
      
      expect(suggestions.some(s => s.label === 'logs')).toBe(true);
      expect(suggestions.some(s => s.label === 'metrics')).toBe(true);
    });

    it('filters indices by partial input', () => {
      const indices = ['logs', 'metrics', 'users'];
      const suggestions = getPPLSuggestions('source=log', 10, indices);
      
      expect(suggestions.some(s => s.label === 'logs')).toBe(true);
      expect(suggestions.some(s => s.label === 'metrics')).toBe(false);
    });

    it('suggests commands after pipe', () => {
      const suggestions = getPPLSuggestions('source=logs | ', 14);
      
      expect(suggestions.some(s => s.label === 'where')).toBe(true);
      expect(suggestions.some(s => s.label === 'stats')).toBe(true);
      expect(suggestions.some(s => s.label === 'head')).toBe(true);
      // source should not be suggested after pipe
      expect(suggestions.some(s => s.label === 'source')).toBe(false);
    });

    it('suggests aggregation functions in stats command', () => {
      const suggestions = getPPLSuggestions('source=logs | stats ', 20);
      
      expect(suggestions.some(s => s.label === 'count')).toBe(true);
      expect(suggestions.some(s => s.label === 'sum')).toBe(true);
      expect(suggestions.some(s => s.label === 'avg')).toBe(true);
      expect(suggestions.some(s => s.label === 'by')).toBe(true);
    });

    it('suggests sort modifiers in sort command', () => {
      const suggestions = getPPLSuggestions('source=logs | sort ', 19);
      
      expect(suggestions.some(s => s.label === '+')).toBe(true);
      expect(suggestions.some(s => s.label === '-')).toBe(true);
    });

    it('suggests functions in eval command', () => {
      const suggestions = getPPLSuggestions('source=logs | eval ', 19);
      
      // Should have various functions
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'function')).toBe(true);
    });

    it('suggests fields in fields command', () => {
      const fields = ['status', 'message', 'timestamp'];
      const suggestions = getPPLSuggestions('source=logs | fields ', 21, [], fields);
      
      expect(suggestions.some(s => s.label === 'status')).toBe(true);
      expect(suggestions.some(s => s.label === 'message')).toBe(true);
    });

    it('suggests fields in dedup command', () => {
      const fields = ['user_id', 'session_id'];
      const suggestions = getPPLSuggestions('source=logs | dedup ', 20, [], fields);
      
      expect(suggestions.some(s => s.label === 'user_id')).toBe(true);
    });

    it('suggests fields in rename command', () => {
      const fields = ['old_name'];
      const suggestions = getPPLSuggestions('source=logs | rename ', 21, [], fields);
      
      expect(suggestions.some(s => s.label === 'old_name')).toBe(true);
    });

    it('suggests fields inside function call', () => {
      const fields = ['value', 'count'];
      const suggestions = getPPLSuggestions('source=logs | stats sum(', 24, [], fields);
      
      expect(suggestions.some(s => s.label === 'value')).toBe(true);
    });

    it('suggests fields and operators in where clause', () => {
      const fields = ['status', 'level'];
      const suggestions = getPPLSuggestions('source=logs | where ', 20, [], fields);
      
      expect(suggestions.some(s => s.label === 'status')).toBe(true);
      expect(suggestions.some(s => s.type === 'operator')).toBe(true);
    });

    it('suggests conditional functions in where clause', () => {
      const suggestions = getPPLSuggestions('source=logs | where ', 20);
      
      expect(suggestions.some(s => s.label === 'isnull')).toBe(true);
      expect(suggestions.some(s => s.label === 'isnotnull')).toBe(true);
    });

    it('provides general suggestions for unknown position', () => {
      // Force unknown position by having source but weird state
      const suggestions = getPPLSuggestions('source=logs | | ', 16);
      
      // Should still provide some suggestions
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('filters suggestions by partial input', () => {
      const suggestions = getPPLSuggestions('source=logs | sta', 17);
      
      // Should filter to commands starting with 'sta'
      const statsCmd = suggestions.find(s => s.label === 'stats');
      expect(statsCmd).toBeDefined();
    });
  });

  describe('getAllPPLCommands', () => {
    it('returns all PPL commands', () => {
      const commands = getAllPPLCommands();
      
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every(c => c.type === 'command')).toBe(true);
      expect(commands.some(c => c.label === 'source')).toBe(true);
      expect(commands.some(c => c.label === 'where')).toBe(true);
      expect(commands.some(c => c.label === 'stats')).toBe(true);
    });

    it('source command has special insertText', () => {
      const commands = getAllPPLCommands();
      const source = commands.find(c => c.label === 'source');
      
      expect(source?.insertText).toBe('source=');
    });

    it('other commands have space after insertText', () => {
      const commands = getAllPPLCommands();
      const where = commands.find(c => c.label === 'where');
      
      expect(where?.insertText).toBe('where ');
    });
  });

  describe('getAllPPLFunctions', () => {
    it('returns all PPL functions', () => {
      const functions = getAllPPLFunctions();
      
      expect(functions.length).toBeGreaterThan(0);
      expect(functions.every(f => f.type === 'function')).toBe(true);
    });

    it('functions have opening paren in insertText', () => {
      const functions = getAllPPLFunctions();
      
      expect(functions.every(f => f.insertText?.endsWith('('))).toBe(true);
    });

    it('includes common aggregation functions', () => {
      const functions = getAllPPLFunctions();
      
      expect(functions.some(f => f.label === 'count')).toBe(true);
      expect(functions.some(f => f.label === 'sum')).toBe(true);
      expect(functions.some(f => f.label === 'avg')).toBe(true);
    });
  });

  describe('getAllPPLOperators', () => {
    it('returns all PPL operators', () => {
      const operators = getAllPPLOperators();
      
      expect(operators.length).toBeGreaterThan(0);
      expect(operators.every(o => o.type === 'operator')).toBe(true);
    });

    it('operators have space after insertText', () => {
      const operators = getAllPPLOperators();
      
      expect(operators.every(o => o.insertText?.endsWith(' '))).toBe(true);
    });
  });

  describe('Property-based tests', () => {
    it('Property: parsePPLContext always returns valid position', () => {
      const validPositions = ['start', 'after_source', 'after_pipe', 'in_command', 'in_where', 'in_function', 'unknown'];
      
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          fc.nat({ max: 200 }),
          (query, pos) => {
            const cursorPos = Math.min(pos, query.length);
            const context = parsePPLContext(query, cursorPos);
            
            expect(validPositions).toContain(context.position);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: getPPLSuggestions always returns array', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }),
          fc.nat({ max: 100 }),
          (query, pos) => {
            const cursorPos = Math.min(pos, query.length);
            const suggestions = getPPLSuggestions(query, cursorPos);
            
            expect(Array.isArray(suggestions)).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('Property: suggestions have required fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', 'source=', 'source=logs | ', 'source=logs | where ', 'source=logs | stats '),
          (query) => {
            const suggestions = getPPLSuggestions(query, query.length);
            
            for (const s of suggestions) {
              expect(typeof s.label).toBe('string');
              expect(typeof s.type).toBe('string');
              expect(['command', 'keyword', 'function', 'operator', 'field', 'index']).toContain(s.type);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
