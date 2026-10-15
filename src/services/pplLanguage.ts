// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * PPL Language Definition for Monaco Editor
 * Provides syntax highlighting for OpenSearch PPL queries
 * Requirements: PPL 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import type * as Monaco from 'monaco-editor';

export const PPL_LANGUAGE_ID = 'ppl';

/**
 * PPL Monarch tokenizer definition
 * Provides syntax highlighting rules for PPL queries
 */
export const PPL_MONARCH_TOKENS: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  ignoreCase: true,
  
  // PPL commands (matching PPL_COMMANDS in types/ppl.ts)
  commands: [
    'source', 'explain', 'where', 'fields', 'stats', 'sort', 'head',
    'dedup', 'eval', 'rename', 'rare', 'top', 'parse', 'grok', 
    'patterns', 'lookup', 'join', 'eventstats', 'trendline',
    'flatten', 'expand', 'fillnull', 'fieldsummary'
  ],
  
  // PPL keywords
  keywords: [
    'as', 'by', 'asc', 'desc', 'true', 'false', 'null',
    'keepempty', 'consecutive', 'left', 'right', 'inner', 'outer',
    'interval', 'from', 'to'
  ],
  
  // Logical and comparison operators
  operators: [
    'AND', 'OR', 'NOT', 'LIKE', 'REGEXP', 'IN', 'BETWEEN',
    'IS', 'NULL'
  ],
  
  // Aggregation and built-in functions
  functions: [
    // Aggregation functions
    'count', 'sum', 'avg', 'min', 'max', 'stddev', 'stddev_pop', 
    'stddev_samp', 'var', 'var_pop', 'var_samp', 'percentile',
    'percentile_approx', 'first', 'last', 'distinct_count', 'dc',
    // String functions
    'concat', 'substr', 'substring', 'trim', 'ltrim', 'rtrim',
    'lower', 'upper', 'length', 'replace', 'like',
    // Date functions
    'now', 'curdate', 'date', 'time', 'year', 'month', 'day',
    'dayofweek', 'hour', 'minute', 'second', 'date_format',
    'date_add', 'date_sub', 'datediff', 'timestampdiff',
    // Math functions
    'abs', 'ceil', 'ceiling', 'floor', 'round', 'sqrt', 'pow',
    'power', 'log', 'log10', 'log2', 'exp', 'mod',
    // Conditional functions
    'if', 'ifnull', 'nullif', 'isnull', 'isnotnull', 'coalesce', 'case',
    // Type functions
    'cast', 'typeof'
  ],
  
  // Symbol operators
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  
  // Escape sequences
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
  tokenizer: {
    root: [
      // Pipe operator - distinctive styling
      [/\|/, 'delimiter.pipe'],
      
      // Comments (PPL supports // style comments)
      [/\/\/.*$/, 'comment'],
      
      // Commands - check before identifiers (matching PPL_COMMANDS in types/ppl.ts)
      [/\b(source|explain|where|fields|stats|sort|head|dedup|eval|rename|rare|top|parse|grok|patterns|lookup|join|eventstats|trendline|flatten|expand|fillnull|fieldsummary)\b/i, 'keyword.command'],
      
      // Keywords
      [/\b(as|by|asc|desc|true|false|null|keepempty|consecutive|left|right|inner|outer|interval|from|to)\b/i, 'keyword'],
      
      // Logical operators (word-based)
      [/\b(AND|OR|NOT|LIKE|REGEXP|IN|BETWEEN|IS\s+NULL|IS\s+NOT\s+NULL)\b/i, 'keyword.operator'],
      
      // Functions - match function name followed by opening paren
      [/\b(count|sum|avg|min|max|stddev|stddev_pop|stddev_samp|var|var_pop|var_samp|percentile|percentile_approx|first|last|distinct_count|dc|concat|substr|substring|trim|ltrim|rtrim|lower|upper|length|replace|like|now|curdate|date|time|year|month|day|dayofweek|hour|minute|second|date_format|date_add|date_sub|datediff|timestampdiff|abs|ceil|ceiling|floor|round|sqrt|pow|power|log|log10|log2|exp|mod|if|ifnull|nullif|isnull|isnotnull|coalesce|case|cast|typeof)\s*(?=\()/i, 'function'],
      
      // Strings - double quoted
      [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
      [/"/, 'string', '@string_double'],
      
      // Strings - single quoted
      [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
      [/'/, 'string', '@string_single'],
      
      // Numbers
      [/\d+\.\d*([eE][\-+]?\d+)?/, 'number.float'],
      [/\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+[eE][\-+]?\d+/, 'number.float'],
      [/\d+/, 'number'],
      
      // Comparison operators
      [/[<>]=?/, 'operator.comparison'],
      [/[!=]=/, 'operator.comparison'],
      [/=/, 'operator.assignment'],
      
      // Arithmetic operators
      [/[+\-*\/%]/, 'operator.arithmetic'],
      
      // Delimiters
      [/[(),]/, 'delimiter'],
      [/\./, 'delimiter.dot'],
      
      // Identifiers (field names, index names)
      // Support for dotted field names like @timestamp, _source, etc.
      [/@?[a-zA-Z_][\w\-.*]*/, 'identifier'],
      
      // Backtick quoted identifiers
      [/`[^`]+`/, 'identifier.quoted'],
      
      // Whitespace
      [/\s+/, 'white'],
    ],
    
    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
    
    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
  },
};

/**
 * PPL language configuration for Monaco
 */
export const PPL_LANGUAGE_CONFIG: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
  },
  brackets: [
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
};

/**
 * PPL theme tokens for custom styling
 */
export const PPL_THEME_RULES: Monaco.editor.ITokenThemeRule[] = [
  { token: 'keyword.command.ppl', foreground: '0000FF', fontStyle: 'bold' },
  { token: 'keyword.ppl', foreground: '0000FF' },
  { token: 'keyword.operator.ppl', foreground: 'AF00DB' },
  { token: 'function.ppl', foreground: '795E26' },
  { token: 'string.ppl', foreground: 'A31515' },
  { token: 'number.ppl', foreground: '098658' },
  { token: 'number.float.ppl', foreground: '098658' },
  { token: 'operator.comparison.ppl', foreground: '000000' },
  { token: 'operator.assignment.ppl', foreground: '000000' },
  { token: 'operator.arithmetic.ppl', foreground: '000000' },
  { token: 'delimiter.pipe.ppl', foreground: 'AF00DB', fontStyle: 'bold' },
  { token: 'identifier.ppl', foreground: '001080' },
  { token: 'identifier.quoted.ppl', foreground: '001080' },
  { token: 'comment.ppl', foreground: '008000', fontStyle: 'italic' },
];

// Track if PPL language has been registered
let pplLanguageRegistered = false;

/**
 * Register PPL language with Monaco editor
 * Should be called once before creating any PPL editors
 */
export function registerPPLLanguage(monaco: typeof Monaco): void {
  if (pplLanguageRegistered) {
    return;
  }
  
  // Register the language
  monaco.languages.register({ id: PPL_LANGUAGE_ID });
  
  // Set the tokenizer
  monaco.languages.setMonarchTokensProvider(PPL_LANGUAGE_ID, PPL_MONARCH_TOKENS);
  
  // Set the language configuration
  monaco.languages.setLanguageConfiguration(PPL_LANGUAGE_ID, PPL_LANGUAGE_CONFIG);
  
  pplLanguageRegistered = true;
}

/**
 * Check if PPL language is registered
 */
export function isPPLLanguageRegistered(): boolean {
  return pplLanguageRegistered;
}

/**
 * Tokenize a PPL query string for testing
 * Returns an array of token types for each segment
 */
export function tokenizePPL(query: string): Array<{ text: string; type: string }> {
  const tokens: Array<{ text: string; type: string }> = [];
  
  // Simple tokenization for testing - matches the monarch rules
  const patterns: Array<{ regex: RegExp; type: string }> = [
    { regex: /^\|/, type: 'delimiter.pipe' },
    { regex: /^\/\/.*/, type: 'comment' },
    { regex: /^(source|explain|where|fields|stats|sort|head|dedup|eval|rename|rare|top|parse|grok|patterns|lookup|join|eventstats|trendline|flatten|expand|fillnull|fieldsummary)\b/i, type: 'keyword.command' },
    { regex: /^(as|by|asc|desc|true|false|null|keepempty|consecutive|left|right|inner|outer|interval|from|to)\b/i, type: 'keyword' },
    { regex: /^(AND|OR|NOT|LIKE|REGEXP|IN|BETWEEN)\b/i, type: 'keyword.operator' },
    { regex: /^(IS\s+NOT\s+NULL|IS\s+NULL)\b/i, type: 'keyword.operator' },
    { regex: /^(count|sum|avg|min|max|stddev|first|last|distinct_count|dc|concat|substr|trim|lower|upper|length|now|date|year|month|day|hour|abs|ceil|floor|round|sqrt|if|ifnull|isnull|cast)\s*(?=\()/i, type: 'function' },
    { regex: /^"([^"\\]|\\.)*"/, type: 'string' },
    { regex: /^'([^'\\]|\\.)*'/, type: 'string' },
    { regex: /^\d+\.\d*([eE][\-+]?\d+)?/, type: 'number.float' },
    { regex: /^\.\d+([eE][\-+]?\d+)?/, type: 'number.float' },
    { regex: /^\d+/, type: 'number' },
    { regex: /^[<>]=?/, type: 'operator.comparison' },
    { regex: /^[!=]=/, type: 'operator.comparison' },
    { regex: /^=/, type: 'operator.assignment' },
    { regex: /^[+\-*\/%]/, type: 'operator.arithmetic' },
    { regex: /^[(),]/, type: 'delimiter' },
    { regex: /^\./, type: 'delimiter.dot' },
    { regex: /^`[^`]+`/, type: 'identifier.quoted' },
    { regex: /^@?[a-zA-Z_][\w\-.*]*/, type: 'identifier' },
    { regex: /^\s+/, type: 'white' },
  ];
  
  let remaining = query;
  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, type } of patterns) {
      const match = remaining.match(regex);
      if (match) {
        tokens.push({ text: match[0], type });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Unknown token - skip one character
      const char = remaining[0];
      if (char !== undefined) {
        tokens.push({ text: char, type: 'unknown' });
      }
      remaining = remaining.slice(1);
    }
  }
  
  return tokens;
}
