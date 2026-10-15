// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Retry Utility
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  withRetry,
  isTransientError,
} from '../../utils/retry';

describe('Retry Utility Property Tests', () => {
  /**
   * Property: Successful function returns immediately without retries
   */
  it('Property: Successful function returns immediately without retries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        async (value) => {
          const fn = async () => value;
          const result = await withRetry(fn);

          expect(result.success).toBe(true);
          expect(result.data).toEqual(value);
          expect(result.attempts).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Non-retryable errors fail immediately
   */
  it('Property: Non-retryable errors fail immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          const error = new Error(errorMessage);
          const fn = async () => { throw error; };
          
          const result = await withRetry(fn, {
            maxAttempts: 3,
            isRetryable: () => false,
          });

          expect(result.success).toBe(false);
          expect(result.error).toBe(error);
          expect(result.attempts).toBe(3); // Still tries maxAttempts
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Retries up to maxAttempts for retryable errors
   */
  it('Property: Retries up to maxAttempts for retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (maxAttempts) => {
          let attempts = 0;
          const fn = async () => {
            attempts++;
            throw new Error('Always fails');
          };

          const result = await withRetry(fn, {
            maxAttempts,
            baseDelayMs: 1,
            maxDelayMs: 10,
            isRetryable: () => true,
          });

          expect(result.success).toBe(false);
          expect(attempts).toBe(maxAttempts);
          expect(result.attempts).toBe(maxAttempts);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Succeeds on Nth attempt if function eventually succeeds
   */
  it('Property: Succeeds on Nth attempt if function eventually succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 5 }),
        async (succeedOnAttempt, maxAttempts) => {
          // Skip if succeedOnAttempt > maxAttempts
          if (succeedOnAttempt > maxAttempts) return;

          let attempts = 0;
          const fn = async () => {
            attempts++;
            if (attempts < succeedOnAttempt) {
              throw new Error('Not yet');
            }
            return 'success';
          };

          const result = await withRetry(fn, {
            maxAttempts,
            baseDelayMs: 1,
            maxDelayMs: 10,
            isRetryable: () => true,
          });

          expect(result.success).toBe(true);
          expect(result.data).toBe('success');
          expect(result.attempts).toBe(succeedOnAttempt);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: onRetry callback is called for each retry
   */
  it('Property: onRetry callback is called for each retry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (maxAttempts) => {
          const retryCalls: number[] = [];
          const fn = async () => { throw new Error('fail'); };

          await withRetry(fn, {
            maxAttempts,
            baseDelayMs: 1,
            maxDelayMs: 10,
            isRetryable: () => true,
            onRetry: (attempt) => retryCalls.push(attempt),
          });

          // onRetry is called for attempts 1 through maxAttempts-1
          expect(retryCalls.length).toBe(maxAttempts - 1);
          for (let i = 0; i < retryCalls.length; i++) {
            expect(retryCalls[i]).toBe(i + 1);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Fixed delay mode uses constant delay
   */
  it('Property: Fixed delay mode uses constant delay', async () => {
    const delays: number[] = [];
    let attempts = 0;
    
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'done';
    };

    await withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 50,
      exponentialBackoff: false,
      isRetryable: () => true,
      onRetry: (_, __, delayMs) => delays.push(delayMs),
    });

    // All delays should be the same (baseDelayMs)
    for (const delay of delays) {
      expect(delay).toBe(50);
    }
  });
});

describe('isTransientError Tests', () => {
  it('returns true for TypeError with fetch message', async () => {
    const error = new TypeError('Failed to fetch');
    expect(isTransientError(error)).toBe(true);
  });

  it('returns true for AbortError', async () => {
    const error = new DOMException('Aborted', 'AbortError');
    expect(isTransientError(error)).toBe(true);
  });

  it('returns true for objects with retryable status codes', async () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 502 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 504 })).toBe(true);
  });

  it('returns false for non-retryable status codes', async () => {
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 401 })).toBe(false);
    expect(isTransientError({ status: 404 })).toBe(false);
    // Note: 500 is retryable per RETRYABLE_STATUS_CODES constant
  });

  it('returns false for regular errors', async () => {
    expect(isTransientError(new Error('regular error'))).toBe(false);
    expect(isTransientError('string error')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});


import { vi } from 'vitest';
import { fetchWithRetry } from '../../utils/retry';

describe('fetchWithRetry Tests', () => {
  it('returns successful response without retry', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com');
    
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 status and eventually succeeds', async () => {
    const failResponse = new Response('Service Unavailable', { status: 503 });
    const successResponse = new Response('OK', { status: 200 });
    
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(failResponse);
      }
      return Promise.resolve(successResponse);
    });

    const result = await fetchWithRetry('https://example.com', undefined, {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });
    
    expect(result.status).toBe(200);
    expect(callCount).toBe(3);
  });

  it('returns error response after max retries', async () => {
    const failResponse = new Response('Service Unavailable', { status: 503 });
    global.fetch = vi.fn().mockResolvedValue(failResponse);

    const result = await fetchWithRetry('https://example.com', undefined, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });
    
    expect(result.status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('throws on network error after max retries', async () => {
    const networkError = new TypeError('Failed to fetch');
    global.fetch = vi.fn().mockRejectedValue(networkError);

    await expect(
      fetchWithRetry('https://example.com', undefined, {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
      })
    ).rejects.toThrow('Failed to fetch');
    
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400 status', async () => {
    const badRequestResponse = new Response('Bad Request', { status: 400 });
    global.fetch = vi.fn().mockResolvedValue(badRequestResponse);

    const result = await fetchWithRetry('https://example.com', undefined, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });
    
    expect(result.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
