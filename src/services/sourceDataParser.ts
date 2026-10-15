// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Source Data Parser Service
 * Parses JSON, JSONL, and CSV input formats into event arrays
 */

import Papa from 'papaparse';
import type { SourceFormat, ValidationResult } from '../types/dataPrepper';

export interface ParseResult {
  success: boolean;
  events: Record<string, unknown>[];
  errors: string[];
}

/**
 * Parse JSON input (single object or array)
 */
export function parseJSON(data: string): ParseResult {
  const trimmed = data.trim();
  if (!trimmed) {
    return { success: true, events: [], errors: [] };
  }

  try {
    const parsed = JSON.parse(trimmed);
    
    if (Array.isArray(parsed)) {
      // Validate all items are objects
      const events: Record<string, unknown>[] = [];
      for (let i = 0; i < parsed.length; i++) {
        if (typeof parsed[i] !== 'object' || parsed[i] === null) {
          return {
            success: false,
            events: [],
            errors: [`Item at index ${i} is not an object`],
          };
        }
        events.push(parsed[i] as Record<string, unknown>);
      }
      return { success: true, events, errors: [] };
    }
    
    if (typeof parsed === 'object' && parsed !== null) {
      return { success: true, events: [parsed as Record<string, unknown>], errors: [] };
    }
    
    return {
      success: false,
      events: [],
      errors: ['JSON must be an object or array of objects'],
    };
  } catch (e) {
    return {
      success: false,
      events: [],
      errors: [e instanceof Error ? e.message : 'Invalid JSON'],
    };
  }
}

/**
 * Parse JSONL (newline-delimited JSON) input
 */
export function parseJSONL(data: string): ParseResult {
  const trimmed = data.trim();
  if (!trimmed) {
    return { success: true, events: [], errors: [] };
  }

  const lines = trimmed.split('\n');
  const events: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue; // Skip empty lines

    try {
      const parsed = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push(`Line ${i + 1}: Expected object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
        continue;
      }
      events.push(parsed as Record<string, unknown>);
    } catch (e) {
      errors.push(`Line ${i + 1}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
    }
  }

  return {
    success: errors.length === 0,
    events,
    errors,
  };
}

/**
 * Parse CSV input with automatic header detection
 */
export function parseCSV(data: string): ParseResult {
  const trimmed = data.trim();
  if (!trimmed) {
    return { success: true, events: [], errors: [] };
  }

  const result = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  const errors: string[] = [];
  
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      const lineInfo = error.row !== undefined ? `Row ${error.row + 1}: ` : '';
      errors.push(`${lineInfo}${error.message}`);
    }
  }

  // Filter out rows that are completely empty
  const events = result.data.filter((row) => {
    return Object.values(row).some((v) => v !== null && v !== undefined && v !== '');
  });

  return {
    success: errors.length === 0,
    events,
    errors,
  };
}

/**
 * Auto-detect format from content
 */
export function detectFormat(data: string): SourceFormat {
  const trimmed = data.trim();
  if (!trimmed) return 'json';

  // Check if it starts with [ or { (JSON)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    // Check if it's JSONL (multiple JSON objects on separate lines)
    const lines = trimmed.split('\n').filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => l.trim().startsWith('{'))) {
      return 'jsonl';
    }
    return 'json';
  }

  // Check for CSV (has commas and multiple lines with consistent structure)
  const lines = trimmed.split('\n');
  if (lines.length >= 2) {
    const firstLine = lines[0];
    const secondLine = lines[1];
    if (firstLine && secondLine) {
      const firstLineCommas = (firstLine.match(/,/g) || []).length;
      const secondLineCommas = (secondLine.match(/,/g) || []).length;
      if (firstLineCommas > 0 && firstLineCommas === secondLineCommas) {
        return 'csv';
      }
    }
  }

  return 'json';
}

/**
 * Parse source data based on format
 */
export function parseSourceData(data: string, format: SourceFormat): ParseResult {
  switch (format) {
    case 'json':
      return parseJSON(data);
    case 'jsonl':
      return parseJSONL(data);
    case 'csv':
      return parseCSV(data);
    default:
      return { success: false, events: [], errors: [`Unknown format: ${format}`] };
  }
}

/**
 * Validate source data without parsing
 */
export function validateSourceData(data: string, format: SourceFormat): ValidationResult {
  const result = parseSourceData(data, format);
  return {
    valid: result.success,
    errors: result.errors.map((message, index) => ({
      line: index + 1,
      column: 1,
      message,
      severity: 'error' as const,
    })),
  };
}
