// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * JSON Validator Utility for OpenSearch Notebook
 * Validates JSON syntax and provides error location information
 * Requirements: 3.4
 */

export interface JsonValidationResult {
  valid: boolean;
  error?: {
    message: string;
    line?: number;
    column?: number;
    position?: number;
  };
}

/**
 * Validate a JSON string and return validation result with error location
 * Requirements: 3.4
 * 
 * @param jsonString - The string to validate as JSON
 * @returns Validation result with valid flag and optional error details
 */
export function validateJson(jsonString: string): JsonValidationResult {
  // Handle empty or whitespace-only strings
  if (!jsonString || jsonString.trim() === '') {
    return {
      valid: false,
      error: {
        message: 'Empty JSON string',
        line: 1,
        column: 1,
        position: 0,
      },
    };
  }

  try {
    JSON.parse(jsonString);
    return { valid: true };
  } catch (e) {
    if (e instanceof SyntaxError) {
      const errorInfo = parseJsonSyntaxError(e, jsonString);
      return {
        valid: false,
        error: errorInfo,
      };
    }
    
    // Fallback for unexpected error types
    return {
      valid: false,
      error: {
        message: e instanceof Error ? e.message : 'Unknown JSON parsing error',
      },
    };
  }
}

/**
 * Parse a JSON SyntaxError to extract position information
 */
function parseJsonSyntaxError(
  error: SyntaxError,
  jsonString: string
): { message: string; line?: number; column?: number; position?: number } {
  const message = error.message;
  
  // Try to extract position from error message
  // Common formats:
  // - "Unexpected token X in JSON at position N"
  // - "Unexpected end of JSON input"
  // - "Expected property name or '}' in JSON at position N"
  const positionMatch = message.match(/at position (\d+)/);
  
  if (positionMatch && positionMatch[1]) {
    const position = parseInt(positionMatch[1], 10);
    const { line, column } = getLineAndColumn(jsonString, position);
    
    return {
      message,
      line,
      column,
      position,
    };
  }
  
  // For "Unexpected end of JSON input", position is at the end
  if (message.includes('Unexpected end of JSON input') || message.includes('end of JSON')) {
    const position = jsonString.length;
    const { line, column } = getLineAndColumn(jsonString, position);
    
    return {
      message,
      line,
      column,
      position,
    };
  }
  
  // Fallback: return message without position
  return { message };
}

/**
 * Convert a character position to line and column numbers
 */
function getLineAndColumn(
  text: string,
  position: number
): { line: number; column: number } {
  const lines = text.substring(0, position).split('\n');
  const line = lines.length;
  const lastLine = lines[lines.length - 1];
  const column = (lastLine?.length ?? 0) + 1;
  
  return { line, column };
}

/**
 * Check if a string is valid JSON without detailed error info
 * Useful for quick validation checks
 */
export function isValidJson(jsonString: string): boolean {
  return validateJson(jsonString).valid;
}
