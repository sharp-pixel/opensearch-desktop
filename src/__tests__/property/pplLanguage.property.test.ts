// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for PPL Language tokenization
 * Property 7: PPL Syntax Highlighting Coverage
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { tokenizePPL } from '../../services/pplLanguage';
import { PPL_COMMANDS } from '../../types/ppl';

describe('Property 7: PPL Syntax Highlighting Coverage', () => {
  /**
   * Property: PPL commands should be tokenized as keyword.command
   * Validates: Requirement 3.1
   */
  it('should tokenize PPL commands as keyword.command', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PPL_COMMANDS.map(c => c.name)),
        (command) => {
          const tokens = tokenizePPL(command);
          const commandToken = tokens.find(t => t.text.toLowerCase() === command.toLowerCase());
          expect(commandToken).toBeDefined();
          expect(commandToken?.type).toBe('keyword.command');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: PPL functions followed by ( should be tokenized as function
   * Validates: Requirement 3.2
   */
  it('should tokenize PPL functions as function when followed by parenthesis', () => {
    // Test a subset of common functions
    const commonFunctions = ['count', 'sum', 'avg', 'min', 'max', 'first', 'last', 'if', 'cast', 'lower', 'upper'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...commonFunctions),
        (funcName) => {
          const query = `${funcName}(field)`;
          const tokens = tokenizePPL(query);
          const funcToken = tokens.find(t => t.text.toLowerCase() === funcName.toLowerCase());
          expect(funcToken).toBeDefined();
          expect(funcToken?.type).toBe('function');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Logical operators should be tokenized as keyword.operator
   * Validates: Requirement 3.3
   */
  it('should tokenize logical operators as keyword.operator', () => {
    const logicalOperators = ['AND', 'OR', 'NOT', 'LIKE', 'REGEXP', 'IN', 'BETWEEN'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...logicalOperators),
        (op) => {
          const query = `field ${op} value`;
          const tokens = tokenizePPL(query);
          const opToken = tokens.find(t => t.text.toUpperCase() === op.toUpperCase());
          expect(opToken).toBeDefined();
          expect(opToken?.type).toBe('keyword.operator');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: String literals should be tokenized as string
   * Validates: Requirement 3.4
   */
  it('should tokenize double-quoted strings as string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('"') && !s.includes('\\')),
        (content) => {
          const query = `"${content}"`;
          const tokens = tokenizePPL(query);
          const stringToken = tokens.find(t => t.type === 'string');
          expect(stringToken).toBeDefined();
          expect(stringToken?.text).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should tokenize single-quoted strings as string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("'") && !s.includes('\\')),
        (content) => {
          const query = `'${content}'`;
          const tokens = tokenizePPL(query);
          const stringToken = tokens.find(t => t.type === 'string');
          expect(stringToken).toBeDefined();
          expect(stringToken?.text).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Numeric literals should be tokenized as number
   * Validates: Requirement 3.5
   */
  it('should tokenize integers as number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999 }),
        (num) => {
          const query = `${num}`;
          const tokens = tokenizePPL(query);
          const numToken = tokens.find(t => t.type === 'number');
          expect(numToken).toBeDefined();
          expect(numToken?.text).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should tokenize floating point numbers as number.float', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
        (num) => {
          // Format to ensure decimal point
          const query = num.toFixed(2);
          const tokens = tokenizePPL(query);
          const numToken = tokens.find(t => t.type === 'number.float');
          expect(numToken).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pipe operator should be tokenized as delimiter.pipe
   */
  it('should tokenize pipe operator as delimiter.pipe', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('|', '| ', ' |'),
        (pipeStr) => {
          const tokens = tokenizePPL(pipeStr);
          const pipeToken = tokens.find(t => t.type === 'delimiter.pipe');
          expect(pipeToken).toBeDefined();
          expect(pipeToken?.text).toBe('|');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Comparison operators should be tokenized correctly
   */
  it('should tokenize comparison operators', () => {
    const comparisonOps = ['<', '>', '<=', '>=', '!=', '=='];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...comparisonOps),
        (op) => {
          const tokens = tokenizePPL(op);
          const opToken = tokens.find(t => t.text === op);
          expect(opToken).toBeDefined();
          expect(opToken?.type).toMatch(/operator\.(comparison|assignment)/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Identifiers should be tokenized as identifier
   */
  it('should tokenize field names as identifier', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        (fieldName) => {
          // Skip if it matches a keyword (note: 'tail' is not a valid PPL command)
          const keywords = ['source', 'where', 'fields', 'stats', 'sort', 'head', 
                          'dedup', 'eval', 'rename', 'as', 'by', 'asc', 'desc', 'true', 
                          'false', 'null', 'and', 'or', 'not', 'like', 'in', 'between',
                          'eventstats', 'trendline', 'flatten', 'expand', 'fillnull', 'fieldsummary'];
          if (keywords.includes(fieldName.toLowerCase())) {
            return true; // Skip this case
          }
          
          const tokens = tokenizePPL(fieldName);
          const idToken = tokens.find(t => t.text === fieldName);
          expect(idToken).toBeDefined();
          expect(idToken?.type).toBe('identifier');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Complete PPL queries should tokenize all parts correctly
   */
  it('should tokenize complete PPL queries with all token types', () => {
    const queries = [
      'source=logs-* | where status > 400 | head 10',
      'source=events | stats count() by host',
      'source=metrics | where value >= 100 AND name LIKE "cpu*"',
      'source=data | eval total = price * quantity | fields name, total',
      'source=logs | sort - @timestamp | head 50',
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...queries),
        (query) => {
          const tokens = tokenizePPL(query);
          
          // Should have multiple tokens
          expect(tokens.length).toBeGreaterThan(5);
          
          // Should have source command
          const sourceToken = tokens.find(t => t.text.toLowerCase() === 'source');
          expect(sourceToken?.type).toBe('keyword.command');
          
          // Should have pipe delimiter
          const pipeToken = tokens.find(t => t.type === 'delimiter.pipe');
          expect(pipeToken).toBeDefined();
          
          // No unknown tokens
          const unknownTokens = tokens.filter(t => t.type === 'unknown');
          expect(unknownTokens.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Keywords should be case-insensitive
   */
  it('should tokenize keywords case-insensitively', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SOURCE', 'Source', 'source', 'WHERE', 'Where', 'where'),
        (keyword) => {
          const tokens = tokenizePPL(keyword);
          const kwToken = tokens.find(t => t.text.toLowerCase() === keyword.toLowerCase());
          expect(kwToken).toBeDefined();
          expect(kwToken?.type).toMatch(/keyword/);
        }
      ),
      { numRuns: 100 }
    );
  });
});


import { 
  PPL_LANGUAGE_ID, 
  PPL_MONARCH_TOKENS, 
  PPL_LANGUAGE_CONFIG, 
  PPL_THEME_RULES,
  registerPPLLanguage,
  isPPLLanguageRegistered,
} from '../../services/pplLanguage';

describe('PPL Language Configuration Tests', () => {
  /**
   * Test: PPL_LANGUAGE_ID is defined correctly
   */
  it('should have correct language ID', () => {
    expect(PPL_LANGUAGE_ID).toBe('ppl');
  });

  /**
   * Test: PPL_MONARCH_TOKENS has required properties
   */
  it('should have valid monarch token configuration', () => {
    expect(PPL_MONARCH_TOKENS).toBeDefined();
    expect(PPL_MONARCH_TOKENS.defaultToken).toBe('');
    expect(PPL_MONARCH_TOKENS.ignoreCase).toBe(true);
    expect(PPL_MONARCH_TOKENS.commands).toBeDefined();
    expect(Array.isArray(PPL_MONARCH_TOKENS.commands)).toBe(true);
    expect(PPL_MONARCH_TOKENS.keywords).toBeDefined();
    expect(PPL_MONARCH_TOKENS.operators).toBeDefined();
    expect(PPL_MONARCH_TOKENS.functions).toBeDefined();
    expect(PPL_MONARCH_TOKENS.tokenizer).toBeDefined();
    expect(PPL_MONARCH_TOKENS.tokenizer.root).toBeDefined();
  });

  /**
   * Test: PPL_LANGUAGE_CONFIG has required properties
   */
  it('should have valid language configuration', () => {
    expect(PPL_LANGUAGE_CONFIG).toBeDefined();
    expect(PPL_LANGUAGE_CONFIG.comments).toBeDefined();
    expect(PPL_LANGUAGE_CONFIG.comments?.lineComment).toBe('//');
    expect(PPL_LANGUAGE_CONFIG.brackets).toBeDefined();
    expect(PPL_LANGUAGE_CONFIG.autoClosingPairs).toBeDefined();
    expect(PPL_LANGUAGE_CONFIG.surroundingPairs).toBeDefined();
    expect(PPL_LANGUAGE_CONFIG.wordPattern).toBeDefined();
  });

  /**
   * Test: PPL_THEME_RULES has valid theme rules
   */
  it('should have valid theme rules', () => {
    expect(PPL_THEME_RULES).toBeDefined();
    expect(Array.isArray(PPL_THEME_RULES)).toBe(true);
    expect(PPL_THEME_RULES.length).toBeGreaterThan(0);
    
    for (const rule of PPL_THEME_RULES) {
      expect(rule.token).toBeDefined();
      expect(typeof rule.token).toBe('string');
      expect(rule.foreground).toBeDefined();
    }
  });

  /**
   * Test: isPPLLanguageRegistered returns boolean
   */
  it('should return registration status', () => {
    const status = isPPLLanguageRegistered();
    expect(typeof status).toBe('boolean');
  });

  /**
   * Test: registerPPLLanguage handles mock Monaco
   */
  it('should handle Monaco registration', () => {
    // Create a mock Monaco object
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
      },
    };

    // This should not throw
    expect(() => {
      registerPPLLanguage(mockMonaco as any);
    }).not.toThrow();
  });

  /**
   * Test: Monarch tokens include all PPL commands
   */
  it('should include all PPL commands in monarch tokens', () => {
    const expectedCommands = [
      'source', 'where', 'fields', 'stats', 'sort', 'head',
      'dedup', 'eval', 'rename', 'rare', 'top', 'parse', 'grok',
      'patterns', 'lookup', 'join', 'eventstats', 'trendline',
      'flatten', 'expand', 'fillnull', 'fieldsummary'
    ];
    
    for (const cmd of expectedCommands) {
      expect(PPL_MONARCH_TOKENS.commands).toContain(cmd);
    }
  });

  /**
   * Test: Monarch tokens include common functions
   */
  it('should include common functions in monarch tokens', () => {
    const expectedFunctions = [
      'count', 'sum', 'avg', 'min', 'max', 'concat', 'substr',
      'lower', 'upper', 'now', 'date', 'abs', 'ceil', 'floor',
      'if', 'cast'
    ];
    
    for (const func of expectedFunctions) {
      expect(PPL_MONARCH_TOKENS.functions).toContain(func);
    }
  });
});

import { vi, beforeEach } from 'vitest';

describe('PPL Language Registration Edge Cases', () => {
  beforeEach(() => {
    // Reset module state between tests
    vi.resetModules();
  });

  it('should handle double registration gracefully', async () => {
    // Import fresh module
    const { registerPPLLanguage } = await import('../../services/pplLanguage');
    
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
      },
    };

    // First registration
    registerPPLLanguage(mockMonaco as any);
    expect(mockMonaco.languages.register).toHaveBeenCalledTimes(1);
    
    // Second registration should be a no-op
    registerPPLLanguage(mockMonaco as any);
    expect(mockMonaco.languages.register).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should tokenize unknown characters as unknown type', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    // Use characters that don't match any pattern
    const tokens = tokenizePPL('§');
    const unknownToken = tokens.find((t: { type: string }) => t.type === 'unknown');
    expect(unknownToken).toBeDefined();
    expect(unknownToken?.text).toBe('§');
  });

  it('should handle empty string tokenization', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens = tokenizePPL('');
    expect(tokens).toEqual([]);
  });

  it('should tokenize IS NULL and IS NOT NULL operators', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens1 = tokenizePPL('field IS NULL');
    const isNullToken = tokens1.find((t: { text: string; type: string }) => 
      t.text.toUpperCase().includes('IS') && t.type === 'keyword.operator'
    );
    expect(isNullToken).toBeDefined();
    
    const tokens2 = tokenizePPL('field IS NOT NULL');
    const isNotNullToken = tokens2.find((t: { text: string; type: string }) => 
      t.text.toUpperCase().includes('IS') && t.type === 'keyword.operator'
    );
    expect(isNotNullToken).toBeDefined();
  });

  it('should tokenize backtick-quoted identifiers', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens = tokenizePPL('`field with spaces`');
    const quotedToken = tokens.find((t: { type: string }) => t.type === 'identifier.quoted');
    expect(quotedToken).toBeDefined();
    expect(quotedToken?.text).toBe('`field with spaces`');
  });

  it('should tokenize comments', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens = tokenizePPL('// this is a comment');
    const commentToken = tokens.find((t: { type: string }) => t.type === 'comment');
    expect(commentToken).toBeDefined();
  });

  it('should tokenize arithmetic operators', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const operators = ['+', '-', '*', '/', '%'];
    for (const op of operators) {
      const tokens = tokenizePPL(`a ${op} b`);
      const opToken = tokens.find((t: { text: string; type: string }) => 
        t.text === op && t.type === 'operator.arithmetic'
      );
      expect(opToken).toBeDefined();
    }
  });

  it('should tokenize scientific notation numbers', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens = tokenizePPL('1.5e10');
    const numToken = tokens.find((t: { type: string }) => t.type === 'number.float');
    expect(numToken).toBeDefined();
  });

  it('should tokenize @ prefixed field names', async () => {
    const { tokenizePPL } = await import('../../services/pplLanguage');
    
    const tokens = tokenizePPL('@timestamp');
    const idToken = tokens.find((t: { text: string; type: string }) => 
      t.text === '@timestamp' && t.type === 'identifier'
    );
    expect(idToken).toBeDefined();
  });
});
