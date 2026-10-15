// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Date Processor Implementation
 * Parses and formats date/time fields
 */

import type { DateConfig } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, deepClone } from './utils';

/**
 * Apply date processor to an event
 */
export function applyDate(
  event: Record<string, unknown>,
  config: DateConfig
): Record<string, unknown> {
  let result = deepClone(event);
  const destination = config.destination || '@timestamp';

  // Handle from_time_received (use current time)
  if (config.from_time_received) {
    result = setNestedValue(result, destination, new Date().toISOString());
    return result;
  }

  // Handle match patterns
  if (config.match && Array.isArray(config.match)) {
    for (const matchConfig of config.match) {
      const { key, patterns } = matchConfig;
      const value = getNestedValue(result, key);
      
      if (value === undefined || value === null) {
        continue;
      }

      const stringValue = String(value);
      const parsedDate = parseDate(stringValue, patterns);
      
      if (parsedDate) {
        result = setNestedValue(result, destination, parsedDate.toISOString());
        return result;
      }
    }
  }

  return result;
}

/**
 * Parse a date string using the given patterns
 */
function parseDate(value: string, patterns: string[]): Date | null {
  for (const pattern of patterns) {
    const date = tryParseWithPattern(value, pattern);
    if (date && !isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

/**
 * Try to parse a date with a specific pattern
 */
function tryParseWithPattern(value: string, pattern: string): Date | null {
  // Handle epoch formats
  if (pattern === 'epoch_milli' || pattern === 'epoch_millis' || pattern === 'UNIX_MS') {
    const num = Number(value);
    if (!isNaN(num)) {
      return new Date(num);
    }
  }

  if (pattern === 'epoch_second' || pattern === 'UNIX') {
    const num = Number(value);
    if (!isNaN(num)) {
      return new Date(num * 1000);
    }
  }

  // Handle ISO8601
  if (pattern === 'ISO8601' || pattern === "yyyy-MM-dd'T'HH:mm:ss.SSSZ" || pattern === "yyyy-MM-dd'T'HH:mm:ss.SSSXXX") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Handle common log format: dd/MMM/yyyy:HH:mm:ss Z
  if (pattern === 'dd/MMM/yyyy:HH:mm:ss Z') {
    const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
    if (match) {
      const [, day, month, year, hour, min, sec, tz] = match;
      if (month && tz) {
        const monthIndex = getMonthIndex(month);
        if (monthIndex !== -1) {
          const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}T${hour}:${min}:${sec}${tz.slice(0, 3)}:${tz.slice(3)}`;
          return new Date(dateStr);
        }
      }
    }
  }

  // Handle yyyy-MM-dd HH:mm:ss
  if (pattern === 'yyyy-MM-dd HH:mm:ss') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
    }
  }

  // Handle yyyy-MM-dd
  if (pattern === 'yyyy-MM-dd') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(value);
    }
  }

  return null;
}

/**
 * Get month index from abbreviated month name
 */
function getMonthIndex(month: string): number {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return months.indexOf(month.toLowerCase());
}
