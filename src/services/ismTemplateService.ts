// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Template Service
 * Handles ISM template pattern matching for automatic policy attachment
 */

import type { ISMTemplate } from '../types/ism';

/**
 * Check if an index name matches a glob pattern
 * Supports * (any characters) and ? (single character)
 */
export function matchIndexPattern(pattern: string, indexName: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(indexName);
}

/**
 * Sort templates by priority (higher priority first)
 */
export function sortTemplatesByPriority(templates: ISMTemplate[]): ISMTemplate[] {
  return [...templates].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    return priorityB - priorityA; // Higher priority first
  });
}

/**
 * Find the first matching template for an index name
 * Templates are checked in priority order (highest first)
 */
export function findMatchingTemplate(
  templates: ISMTemplate[],
  indexName: string
): ISMTemplate | null {
  const sorted = sortTemplatesByPriority(templates);
  
  for (const template of sorted) {
    for (const pattern of template.index_patterns) {
      if (matchIndexPattern(pattern, indexName)) {
        return template;
      }
    }
  }
  
  return null;
}

/**
 * Get all templates that match an index name
 * Returns templates in priority order
 */
export function findAllMatchingTemplates(
  templates: ISMTemplate[],
  indexName: string
): ISMTemplate[] {
  const sorted = sortTemplatesByPriority(templates);
  const matches: ISMTemplate[] = [];
  
  for (const template of sorted) {
    for (const pattern of template.index_patterns) {
      if (matchIndexPattern(pattern, indexName)) {
        matches.push(template);
        break; // Only add each template once
      }
    }
  }
  
  return matches;
}

/**
 * Validate an index pattern
 * Returns null if valid, error message if invalid
 */
export function validateIndexPattern(pattern: string): string | null {
  if (!pattern || pattern.trim() === '') {
    return 'Pattern cannot be empty';
  }

  // Check for invalid characters
  const invalidChars = /[<>|"]/;
  if (invalidChars.test(pattern)) {
    return 'Pattern contains invalid characters';
  }

  // Check for patterns that would match nothing
  if (pattern === '*' || pattern === '**') {
    return null; // Valid catch-all patterns
  }

  // Check for consecutive wildcards that don't make sense
  if (pattern.includes('**') && !pattern.includes('***')) {
    // ** is okay, *** is suspicious
  }

  return null; // Valid
}

/**
 * Test multiple index names against a pattern
 * Returns an object with match results
 */
export function testPatternAgainstIndices(
  pattern: string,
  indexNames: string[]
): { matches: string[]; nonMatches: string[] } {
  const matches: string[] = [];
  const nonMatches: string[] = [];

  for (const indexName of indexNames) {
    if (matchIndexPattern(pattern, indexName)) {
      matches.push(indexName);
    } else {
      nonMatches.push(indexName);
    }
  }

  return { matches, nonMatches };
}

/**
 * Generate example index names that would match a pattern
 */
export function generateMatchingExamples(pattern: string): string[] {
  const examples: string[] = [];

  // Replace wildcards with example values
  const example = pattern
    .replace(/\*/g, 'example')
    .replace(/\?/g, 'x');
  
  examples.push(example);

  // Generate variations
  if (pattern.includes('*')) {
    examples.push(pattern.replace(/\*/g, 'logs'));
    examples.push(pattern.replace(/\*/g, 'metrics'));
    examples.push(pattern.replace(/\*/g, '2024-01-01'));
  }

  if (pattern.includes('?')) {
    examples.push(pattern.replace(/\?/g, '1'));
    examples.push(pattern.replace(/\?/g, 'a'));
  }

  // Remove duplicates
  return [...new Set(examples)];
}

/**
 * Explain how a pattern matches
 */
export function explainPattern(pattern: string): string {
  const parts: string[] = [];

  if (pattern === '*') {
    return 'Matches all index names';
  }

  if (!pattern.includes('*') && !pattern.includes('?')) {
    return `Matches exactly: "${pattern}"`;
  }

  // Break down the pattern
  let explanation = pattern;
  
  if (pattern.includes('*')) {
    parts.push('* matches any sequence of characters');
    explanation = explanation.replace(/\*/g, '<any>');
  }

  if (pattern.includes('?')) {
    parts.push('? matches any single character');
    explanation = explanation.replace(/\?/g, '<char>');
  }

  return `Pattern: ${explanation}\n${parts.join('\n')}`;
}

/**
 * Get the specificity score of a pattern
 * Higher score = more specific pattern
 */
export function getPatternSpecificity(pattern: string): number {
  let score = 0;

  // Count literal characters (more = more specific)
  const literalChars = pattern.replace(/[*?]/g, '').length;
  score += literalChars * 10;

  // Penalize wildcards
  const starCount = (pattern.match(/\*/g) || []).length;
  const questionCount = (pattern.match(/\?/g) || []).length;
  
  score -= starCount * 5; // * is less specific
  score -= questionCount * 2; // ? is somewhat specific

  // Bonus for patterns that start with literal characters
  if (pattern.length > 0 && pattern[0] !== '*' && pattern[0] !== '?') {
    score += 5;
  }

  return Math.max(0, score);
}
