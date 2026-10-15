// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Logger Utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  LogLevel,
  configureLogger,
  resetLoggerConfig,
  createLogger,
  logger,
} from '../../utils/logger';

describe('Logger Utility Property Tests', () => {
  beforeEach(() => {
    resetLoggerConfig();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetLoggerConfig();
  });

  describe('Log levels', () => {
    it('Property: DEBUG logs all levels', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('Property: INFO level filters DEBUG', () => {
      configureLogger({ minLevel: LogLevel.INFO });
      
      logger.debug('debug message');
      logger.info('info message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
    });

    it('Property: WARN level filters DEBUG and INFO', () => {
      configureLogger({ minLevel: LogLevel.WARN });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('Property: ERROR level filters all but errors', () => {
      configureLogger({ minLevel: LogLevel.ERROR });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('Property: NONE level filters all logs', () => {
      configureLogger({ minLevel: LogLevel.NONE });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Timestamp formatting', () => {
    it('Property: includes timestamp when configured', () => {
      configureLogger({ minLevel: LogLevel.DEBUG, includeTimestamp: true });
      
      logger.info('test message');
      
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    });

    it('Property: excludes timestamp when not configured', () => {
      configureLogger({ minLevel: LogLevel.DEBUG, includeTimestamp: false });
      
      logger.info('test message');
      
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[0]).not.toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Context logger', () => {
    it('Property: includes context in log messages', () => {
      configureLogger({ minLevel: LogLevel.DEBUG, includeTimestamp: false });
      
      const contextLogger = createLogger('TestContext');
      contextLogger.info('test message');
      
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[0]).toContain('[TestContext]');
    });

    it('Property: context logger has all log methods', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      const contextLogger = createLogger('Test');
      
      expect(typeof contextLogger.debug).toBe('function');
      expect(typeof contextLogger.info).toBe('function');
      expect(typeof contextLogger.warn).toBe('function');
      expect(typeof contextLogger.error).toBe('function');
    });

    it('Property: context logger respects log level', () => {
      configureLogger({ minLevel: LogLevel.ERROR });
      
      const contextLogger = createLogger('Test');
      contextLogger.debug('debug');
      contextLogger.info('info');
      contextLogger.warn('warn');
      contextLogger.error('error');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Data logging', () => {
    it('Property: logs data alongside message', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      const data = { key: 'value', count: 42 };
      logger.info('message', data);
      
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toEqual(data);
    });

    it('Property: handles undefined data', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      logger.info('message');
      
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toBe('');
    });

    it('Property: logs various data types', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      logger.debug('string data', 'test');
      logger.info('number data', 123);
      logger.warn('array data', [1, 2, 3]);
      logger.error('object data', { a: 1 });
      
      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('onLog callback', () => {
    it('Property: calls onLog callback for each log', () => {
      const onLog = vi.fn();
      configureLogger({ minLevel: LogLevel.DEBUG, onLog });
      
      logger.info('test message');
      
      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'test message',
          timestamp: expect.any(Number),
        })
      );
    });

    it('Property: onLog receives data', () => {
      const onLog = vi.fn();
      configureLogger({ minLevel: LogLevel.DEBUG, onLog });
      
      const data = { key: 'value' };
      logger.warn('warning', data);
      
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          message: 'warning',
          data,
        })
      );
    });

    it('Property: onLog receives context', () => {
      const onLog = vi.fn();
      configureLogger({ minLevel: LogLevel.DEBUG, onLog });
      
      const contextLogger = createLogger('MyContext');
      contextLogger.error('error message');
      
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'error message',
          context: 'MyContext',
        })
      );
    });

    it('Property: onLog not called when level filtered', () => {
      const onLog = vi.fn();
      configureLogger({ minLevel: LogLevel.ERROR, onLog });
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      
      expect(onLog).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('Property: configureLogger merges with existing config', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      configureLogger({ includeTimestamp: true });
      
      logger.info('test');
      
      // Should still log (minLevel preserved)
      expect(console.info).toHaveBeenCalled();
    });

    it('Property: resetLoggerConfig restores defaults', () => {
      configureLogger({ minLevel: LogLevel.NONE });
      resetLoggerConfig();
      
      // After reset, should use default level
      // In dev mode, default is DEBUG; in prod, default is WARN
      logger.warn('test');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Property-based tests', () => {
    it('Property: any string message can be logged', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      fc.assert(
        fc.property(fc.string(), (message) => {
          logger.info(message);
          expect(console.info).toHaveBeenCalled();
          vi.mocked(console.info).mockClear();
        })
      );
    });

    it('Property: any context string works', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      
      fc.assert(
        fc.property(fc.string(), (context) => {
          const contextLogger = createLogger(context);
          contextLogger.debug('test');
          expect(console.debug).toHaveBeenCalled();
          vi.mocked(console.debug).mockClear();
        })
      );
    });
  });
});
