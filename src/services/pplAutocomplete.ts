// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * PPL Autocomplete Provider
 * Provides context-aware suggestions for PPL queries
 * Requirements: PPL 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */

import type { 
  PPLSuggestion, 
  PPLContext
} from '../types/ppl';
import { 
  PPL_COMMANDS, 
  PPL_FUNCTIONS, 
  PPL_OPERATORS
} from '../types/ppl';

/** Ignore pipes and parentheses inside strings, quoted identifiers and comments. */
function pplLexicalContext(text: string) {
  let quote = '';
  let comment = false;
  let code = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (comment) {
      if (ch === '\n') comment = false;
      code += ch === '\n' ? '\n' : ' ';
    } else if (quote) {
      if (ch === '\\') { code += '  '; i++; }
      else if (ch === quote) { quote = ''; code += 'x'; }
      else code += 'x';
    } else if (ch === '/' && text[i + 1] === '/') { comment = true; code += ' '; }
    else if (ch === '"' || ch === "'" || ch === '`') { quote = ch; code += 'x'; }
    else code += ch;
  }
  return { code, suppressed: comment || quote === '"' || quote === "'" };
}

/** Include punctuation and the suffix after the caret in identifier replacements. */
export function getPPLCompletionRange(text: string, offset: number) {
  const prefix = text.slice(0, offset);
  const quotedMatch = prefix.match(/`[^`]*$/);
  // Only treat the last backtick as opening when the token is still quoted.
  const quoted = (prefix.match(/`/g)?.length ?? 0) % 2 === 1;
  if (quoted && quotedMatch) {
    const close = text.indexOf('`', offset);
    return { start: offset - quotedMatch[0].length, end: close < 0 ? offset : close + 1, quoted: true };
  }
  const before = prefix.match(/[\w.*@-]*$/)?.[0] ?? '';
  const after = text.slice(offset).match(/^[\w.*@-]*/)?.[0] ?? '';
  return { start: offset - before.length, end: offset + after.length, quoted: false };
}

/**
 * Parse PPL query to determine context at cursor position
 * Requirements: PPL 4.1, 4.2, 4.3, 4.4
 */
export function parsePPLContext(query: string, cursorPosition: number): PPLContext {
  // Get text up to cursor
  const textBeforeCursor = pplLexicalContext(query.slice(0, cursorPosition)).code;
  const trimmedText = textBeforeCursor.trim();
  
  // Empty or start of query
  if (trimmedText.length === 0) {
    return { position: 'start' };
  }
  
  // Extract source index if present
  const sourceMatch = query.slice(0, cursorPosition).match(/\bsource\s*=\s*(?:`([^`]+)`|([^\s|]+))/i);
  const sourceIndex = sourceMatch ? (sourceMatch[1] ?? sourceMatch[2]) : undefined;
  
  // Check if we're right after 'source='
  const afterSourceEquals = /source\s*=\s*$/i.test(textBeforeCursor);
  if (afterSourceEquals) {
    return { position: 'after_source', sourceIndex };
  }
  
  // Check if we're typing the source index (after source= but before pipe)
  const typingSourceIndex = /source\s*=\s*[^\s|]*$/i.test(textBeforeCursor);
  if (typingSourceIndex && !textBeforeCursor.includes('|')) {
    return { position: 'after_source', sourceIndex };
  }
  
  // Check if query starts with 'explain' - handle explain prefix
  const explainMatch = textBeforeCursor.match(/^\s*explain\s+/i);
  const afterExplain = explainMatch ? trimmedText.slice(explainMatch[0].length) : null;
  
  // If we have 'explain' followed by content, check if we're typing source after explain
  if (afterExplain !== null) {
    // Check if we're right after 'explain ' waiting for source
    if (/^explain\s+$/i.test(textBeforeCursor)) {
      return { position: 'after_explain' };
    }
    // Check if we're typing source after explain
    if (/^explain\s+\w*$/i.test(trimmedText) && !afterExplain.includes('=')) {
      return { position: 'after_explain' };
    }
  }
  
  // Check if we're at the start typing 'source' or 'explain' (no pipe, no source= yet)
  // This handles partial typing like 's', 'so', 'sou', 'sourc', 'source', 'e', 'ex', etc.
  if (!sourceIndex && !textBeforeCursor.includes('|') && !explainMatch) {
    // We're at the very beginning, typing something that could be 'source' or 'explain'
    return { position: 'start' };
  }
  
  // Find the last pipe to determine current command context
  const lastPipeIndex = textBeforeCursor.lastIndexOf('|');
  
  // Check if cursor is right after a pipe (with optional whitespace only)
  const afterPipe = /\|\s*$/i.test(textBeforeCursor);
  if (afterPipe) {
    return { position: 'after_pipe', sourceIndex };
  }
  
  // Get text after last pipe
  const textAfterPipe = lastPipeIndex >= 0 
    ? textBeforeCursor.slice(lastPipeIndex + 1).trim()
    : trimmedText;
  
  // Determine current command
  const commandMatch = textAfterPipe.match(/^(\w+)/i);
  const currentCommand = commandMatch && commandMatch[1] ? commandMatch[1].toLowerCase() : undefined;
  
  // Check if we're inside a function call (unclosed parenthesis)
  const openParens = (textAfterPipe.match(/\(/g) || []).length;
  const closeParens = (textAfterPipe.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    // Find the function name
    const funcMatch = textAfterPipe.match(/(\w+)\s*\([^)]*$/i);
    const inFunction = funcMatch && funcMatch[1] ? funcMatch[1].toLowerCase() : undefined;
    return { 
      position: 'in_function', 
      currentCommand, 
      sourceIndex,
      inFunction 
    };
  }
  
  // Check if we're in a where clause
  if (currentCommand === 'where') {
    return { position: 'in_where', currentCommand, sourceIndex };
  }
  
  // Check if we're still typing a command name after a pipe (no space after command yet)
  // This means we're typing something like 'whe' or 'sta' - partial command
  // We need to check the original text (not trimmed) to see if there's a space after the command
  const textAfterPipeUntrimmed = lastPipeIndex >= 0 
    ? textBeforeCursor.slice(lastPipeIndex + 1)
    : textBeforeCursor;
  const hasSpaceAfterCommand = /^\s*\w+\s+/.test(textAfterPipeUntrimmed);
  
  if (lastPipeIndex >= 0 && /^\w*$/i.test(textAfterPipe) && !hasSpaceAfterCommand) {
    return { position: 'after_pipe', sourceIndex };
  }
  
  // Default: we're in a command (command name followed by space or more content)
  if (currentCommand) {
    return { position: 'in_command', currentCommand, sourceIndex };
  }
  
  // If no source yet, we're at start
  if (!sourceIndex) {
    return { position: 'start' };
  }
  
  return { position: 'unknown', sourceIndex };
}

/** Field metadata is needed only after a source and outside strings/comments. */
export function shouldSuggestPPLFields(query: string, offset: number): boolean {
  if (pplLexicalContext(query.slice(0, offset)).suppressed) return false;
  return ['in_command', 'in_function', 'in_where'].includes(parsePPLContext(query, offset).position);
}

/**
 * Get PPL suggestions based on context
 * Requirements: PPL 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */
export function getPPLSuggestions(
  query: string,
  cursorPosition: number,
  indices: string[] = [],
  fields: string[] = []
): PPLSuggestion[] {
  if (pplLexicalContext(query.slice(0, cursorPosition)).suppressed) return [];
  const context = parsePPLContext(query, cursorPosition);
  const suggestions: PPLSuggestion[] = [];
  
  // Get partial text being typed for filtering
  const textBeforeCursor = query.slice(0, cursorPosition);
  const edit = getPPLCompletionRange(query, cursorPosition);
  const partial = textBeforeCursor.slice(edit.start + (edit.quoted ? 1 : 0)).toLowerCase();
  
  switch (context.position) {
    case 'start':
      // At start, suggest 'source' and 'explain' (filter by partial input)
      if (!partial || 'source'.includes(partial)) {
        suggestions.push({
          label: 'source',
          type: 'command',
          description: 'Specify the index to query',
          insertText: 'source=',
          detail: 'source=<index>',
        });
      }
      if (!partial || 'explain'.includes(partial)) {
        suggestions.push({
          label: 'explain',
          type: 'command',
          description: 'Show the execution plan for a query',
          insertText: 'explain ',
          detail: 'explain source=<index> | ...',
        });
      }
      break;
      
    case 'after_explain':
      // After 'explain', suggest 'source'
      if (!partial || 'source'.includes(partial)) {
        suggestions.push({
          label: 'source',
          type: 'command',
          description: 'Specify the index to query',
          insertText: 'source=',
          detail: 'source=<index>',
        });
      }
      break;
      
    case 'after_source':
      // After source=, suggest index names
      for (const index of indices) {
        if (!partial || index.toLowerCase().includes(partial)) {
          suggestions.push({
            label: index,
            type: 'index',
            description: `Index: ${index}`,
            insertText: index,
          });
        }
      }
      // Also suggest common patterns
      if (!partial || 'logs-*'.includes(partial)) {
        suggestions.push({
          label: 'logs-*',
          type: 'index',
          description: 'Log indices pattern',
          insertText: 'logs-*',
        });
      }
      break;
      
    case 'after_pipe':
      // After pipe, suggest commands (except source)
      for (const cmd of PPL_COMMANDS) {
        if (cmd.name === 'source') continue; // source only at start
        if (!partial || cmd.name.toLowerCase().includes(partial)) {
          suggestions.push({
            label: cmd.name,
            type: 'command',
            description: cmd.description,
            insertText: cmd.name + ' ',
            detail: cmd.syntax,
          });
        }
      }
      break;
      
    case 'in_command':
      // In a command, suggest based on command type
      if (context.currentCommand === 'stats') {
        // In stats, suggest aggregation functions
        for (const func of PPL_FUNCTIONS.filter(f => 
          ['count', 'sum', 'avg', 'min', 'max', 'stddev', 'var', 
           'percentile', 'first', 'last', 'distinct_count', 'dc'].includes(f.name)
        )) {
          if (!partial || func.name.toLowerCase().includes(partial)) {
            suggestions.push({
              label: func.name,
              type: 'function',
              description: func.description,
              insertText: func.name + '(',
              detail: func.syntax,
            });
          }
        }
        // Suggest 'by' keyword
        if (!partial || 'by'.includes(partial)) {
          suggestions.push({
            label: 'by',
            type: 'keyword',
            description: 'Group by field',
            insertText: 'by ',
          });
        }
      } else if (context.currentCommand === 'sort') {
        // In sort, suggest fields and sort modifiers
        if (!partial || '+'.includes(partial)) {
          suggestions.push({
            label: '+',
            type: 'keyword',
            description: 'Sort ascending',
            insertText: '+ ',
          });
        }
        if (!partial || '-'.includes(partial)) {
          suggestions.push({
            label: '-',
            type: 'keyword',
            description: 'Sort descending',
            insertText: '- ',
          });
        }
      } else if (context.currentCommand === 'eval') {
        // In eval, suggest functions
        for (const func of PPL_FUNCTIONS) {
          if (!partial || func.name.toLowerCase().includes(partial)) {
            suggestions.push({
              label: func.name,
              type: 'function',
              description: func.description,
              insertText: func.name + '(',
              detail: func.syntax,
            });
          }
        }
      } else if (context.currentCommand === 'fields' || 
                 context.currentCommand === 'dedup' ||
                 context.currentCommand === 'rename') {
        // Suggest field names
        for (const field of fields) {
          if (!partial || field.toLowerCase().includes(partial)) {
            suggestions.push({
              label: field,
              type: 'field',
              description: `Field: ${field}`,
              insertText: field,
            });
          }
        }
      }
      
      // Always suggest fields in commands
      for (const field of fields) {
        if (!partial || field.toLowerCase().includes(partial)) {
          const exists = suggestions.some(s => s.label === field);
          if (!exists) {
            suggestions.push({
              label: field,
              type: 'field',
              description: `Field: ${field}`,
              insertText: field,
            });
          }
        }
      }
      break;
      
    case 'in_function':
      // Inside function, suggest fields
      for (const field of fields) {
        if (!partial || field.toLowerCase().includes(partial)) {
          suggestions.push({
            label: field,
            type: 'field',
            description: `Field: ${field}`,
            insertText: field,
          });
        }
      }
      break;
      
    case 'in_where':
      // In where clause, suggest fields, operators, and functions
      for (const field of fields) {
        if (!partial || field.toLowerCase().includes(partial)) {
          suggestions.push({
            label: field,
            type: 'field',
            description: `Field: ${field}`,
            insertText: field,
          });
        }
      }
      
      // Suggest comparison operators
      for (const op of PPL_OPERATORS) {
        if (!partial || op.name.toLowerCase().includes(partial)) {
          suggestions.push({
            label: op.name,
            type: 'operator',
            description: op.description,
            insertText: op.name + ' ',
          });
        }
      }
      
      // Suggest conditional functions
      for (const func of PPL_FUNCTIONS.filter(f => 
        ['if', 'isnull', 'isnotnull', 'like'].includes(f.name)
      )) {
        if (!partial || func.name.toLowerCase().includes(partial)) {
          suggestions.push({
            label: func.name,
            type: 'function',
            description: func.description,
            insertText: func.name + '(',
            detail: func.syntax,
          });
        }
      }
      break;
      
    case 'unknown':
    default:
      // Provide general suggestions
      for (const cmd of PPL_COMMANDS) {
        if (!partial || cmd.name.toLowerCase().includes(partial)) {
          suggestions.push({
            label: cmd.name,
            type: 'command',
            description: cmd.description,
            insertText: cmd.name + ' ',
            detail: cmd.syntax,
          });
        }
      }
      break;
  }
  
  return suggestions.filter((item, index) => suggestions.findIndex(other => other.label === item.label && other.type === item.type) === index);
}

/**
 * Get all PPL commands for reference
 */
export function getAllPPLCommands(): PPLSuggestion[] {
  return PPL_COMMANDS.map(cmd => ({
    label: cmd.name,
    type: 'command' as const,
    description: cmd.description,
    insertText: cmd.name === 'source' ? 'source=' : cmd.name + ' ',
    detail: cmd.syntax,
  }));
}

/**
 * Get all PPL functions for reference
 */
export function getAllPPLFunctions(): PPLSuggestion[] {
  return PPL_FUNCTIONS.map(func => ({
    label: func.name,
    type: 'function' as const,
    description: func.description,
    insertText: func.name + '(',
    detail: func.syntax,
  }));
}

/**
 * Get all PPL operators for reference
 */
export function getAllPPLOperators(): PPLSuggestion[] {
  return PPL_OPERATORS.map(op => ({
    label: op.name,
    type: 'operator' as const,
    description: op.description,
    insertText: op.name + ' ',
  }));
}
