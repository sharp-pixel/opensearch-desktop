// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * CSV Processor
 * Parses comma-separated values (CSV) strings into structured data
 */

import { getNestedValue, setNestedValue, deleteNestedValue, deepClone } from './utils';

export interface CsvConfig {
  /** Source field containing CSV data (default: "message") */
  source?: string;
  /** Column separator character (default: ",") */
  delimiter?: string;
  /** Text qualifier character (default: '"') */
  quote_character?: string;
  /** User-specified column names */
  column_names?: string[];
  /** Field containing column names from event */
  column_names_source_key?: string;
  /** Delete header field after parsing */
  delete_header?: boolean;
  /** Delete source field after parsing */
  delete_source?: boolean;
  /** Conditional expression */
  when?: string;
}

/**
 * Parse a CSV line respecting quotes
 */
function parseCsvLine(line: string, delimiter: string, quoteChar: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    
    if (char === quoteChar) {
      // Check for escaped quote (double quote)
      if (inQuotes && i + 1 < line.length && line[i + 1] === quoteChar) {
        current += quoteChar;
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

/**
 * Generate column name for auto-generated columns
 */
function generateColumnName(index: number): string {
  return `column${index + 1}`;
}

/**
 * Apply CSV processor to an event
 */
export function applyCsv(
  event: Record<string, unknown>,
  config: CsvConfig
): Record<string, unknown> {
  let result = deepClone(event);
  
  const source = config.source || 'message';
  const delimiter = config.delimiter || ',';
  const quoteChar = config.quote_character || '"';
  
  // Get source value
  const sourceValue = getNestedValue(result, source);
  if (sourceValue === undefined || typeof sourceValue !== 'string') {
    return result;
  }
  
  // Parse CSV data
  const values = parseCsvLine(sourceValue, delimiter, quoteChar);
  
  // Determine column names
  let columnNames: string[] = [];
  
  if (config.column_names_source_key && getNestedValue(result, config.column_names_source_key) !== undefined) {
    // Get column names from event field
    const headerValue = getNestedValue(result, config.column_names_source_key);
    if (typeof headerValue === 'string') {
      columnNames = parseCsvLine(headerValue, delimiter, quoteChar);
    }
    
    // Delete header field if configured
    if (config.delete_header !== false) {
      result = deleteNestedValue(result, config.column_names_source_key);
    }
  } else if (config.column_names && config.column_names.length > 0) {
    columnNames = config.column_names;
  }
  
  // Map values to column names
  for (let i = 0; i < values.length; i++) {
    const columnName = i < columnNames.length 
      ? columnNames[i]! 
      : generateColumnName(i);
    result = setNestedValue(result, columnName, values[i]);
  }
  
  // Delete source field if configured
  if (config.delete_source) {
    result = deleteNestedValue(result, source);
  }
  
  return result;
}
