// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Logger Utility for OpenSearch DevTools
 * Provides structured logging with log levels and optional telemetry hooks
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: unknown;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps in console output */
  includeTimestamp: boolean;
  /** Optional callback for telemetry/monitoring integration */
  onLog?: (entry: LogEntry) => void;
}

/**
 * Default configuration - only show warnings and errors in production
 */
const defaultConfig: LoggerConfig = {
  minLevel: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  includeTimestamp: import.meta.env.DEV,
};

let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Reset logger to default configuration
 */
export function resetLoggerConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Format a log entry for console output
 */
function formatMessage(entry: LogEntry): string {
  const parts: string[] = [];
  
  if (currentConfig.includeTimestamp) {
    parts.push(`[${new Date(entry.timestamp).toISOString()}]`);
  }
  
  if (entry.context) {
    parts.push(`[${entry.context}]`);
  }
  
  parts.push(entry.message);
  
  return parts.join(' ');
}

/**
 * Internal log function
 */
function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (level < currentConfig.minLevel) {
    return;
  }
  
  const entry: LogEntry = {
    level,
    message,
    timestamp: Date.now(),
    context,
    data,
  };
  
  // Call telemetry hook if configured
  currentConfig.onLog?.(entry);
  
  const formattedMessage = formatMessage(entry);
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, data !== undefined ? data : '');
      break;
  }
}

/**
 * Create a logger instance with a specific context
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log(LogLevel.DEBUG, message, context, data),
    info: (message: string, data?: unknown) => log(LogLevel.INFO, message, context, data),
    warn: (message: string, data?: unknown) => log(LogLevel.WARN, message, context, data),
    error: (message: string, data?: unknown) => log(LogLevel.ERROR, message, context, data),
  };
}

/**
 * Default logger instance
 */
export const logger = {
  debug: (message: string, data?: unknown) => log(LogLevel.DEBUG, message, undefined, data),
  info: (message: string, data?: unknown) => log(LogLevel.INFO, message, undefined, data),
  warn: (message: string, data?: unknown) => log(LogLevel.WARN, message, undefined, data),
  error: (message: string, data?: unknown) => log(LogLevel.ERROR, message, undefined, data),
};

export default logger;
