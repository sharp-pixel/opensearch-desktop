// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Rate Limiter Utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  RateLimiter,
  checkQueryRateLimit,
  getQueryRateLimitStatus,
  queryRateLimiter,
} from '../../utils/rateLimiter';

describe('Rate Limiter Property Tests', () => {
  /**
   * Property: Fresh rate limiter allows requests up to maxRequests
   */
  it('Property: Fresh rate limiter allows requests up to maxRequests', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1000, max: 60000 }),
        (maxRequests, windowMs) => {
          const limiter = new RateLimiter({ maxRequests, windowMs });

          // All requests up to maxRequests should be allowed
          for (let i = 0; i < maxRequests; i++) {
            const result = limiter.tryAcquire();
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(maxRequests - i - 1);
          }

          // Next request should be denied
          const denied = limiter.tryAcquire();
          expect(denied.allowed).toBe(false);
          expect(denied.remainingRequests).toBe(0);
          expect(denied.retryAfterMs).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Reset clears all state
   */
  it('Property: Reset clears all state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        (maxRequests, windowMs) => {
          const limiter = new RateLimiter({ maxRequests, windowMs });

          // Exhaust the limiter
          for (let i = 0; i < maxRequests; i++) {
            limiter.tryAcquire();
          }

          // Should be denied
          expect(limiter.tryAcquire().allowed).toBe(false);

          // Reset
          limiter.reset();

          // Should be allowed again
          const result = limiter.tryAcquire();
          expect(result.allowed).toBe(true);
          expect(result.remainingRequests).toBe(maxRequests - 1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: getStatus returns correct remaining count
   */
  it('Property: getStatus returns correct remaining count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 50 }),
        fc.integer({ min: 0, max: 4 }),
        (maxRequests, requestsToMake) => {
          const limiter = new RateLimiter({ maxRequests, windowMs: 60000 });

          // Make some requests
          for (let i = 0; i < requestsToMake; i++) {
            limiter.tryAcquire();
          }

          const status = limiter.getStatus();
          expect(status.remainingRequests).toBe(maxRequests - requestsToMake);
          expect(status.resetInMs).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: minIntervalMs enforces minimum time between requests
   */
  it('Property: minIntervalMs enforces minimum time between requests', () => {
    const limiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      minIntervalMs: 100,
    });

    // First request should be allowed
    const first = limiter.tryAcquire();
    expect(first.allowed).toBe(true);

    // Immediate second request should be denied due to minInterval
    const second = limiter.tryAcquire();
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(0);
    expect(second.retryAfterMs).toBeLessThanOrEqual(100);
  });

  /**
   * Property: Remaining requests is always non-negative
   */
  it('Property: Remaining requests is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        (maxRequests, requestsToMake) => {
          const limiter = new RateLimiter({ maxRequests, windowMs: 60000 });

          for (let i = 0; i < requestsToMake; i++) {
            const result = limiter.tryAcquire();
            expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
          }

          const status = limiter.getStatus();
          expect(status.remainingRequests).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Query Rate Limiter Integration Tests', () => {
  beforeEach(() => {
    queryRateLimiter.reset();
  });

  it('checkQueryRateLimit returns null when allowed', () => {
    const result = checkQueryRateLimit();
    expect(result).toBeNull();
  });

  it('checkQueryRateLimit returns message when rate limited', () => {
    // Exhaust the rate limiter
    for (let i = 0; i < 100; i++) {
      queryRateLimiter.tryAcquire();
    }

    const result = checkQueryRateLimit();
    expect(result).not.toBeNull();
    expect(result).toContain('Rate limit exceeded');
    expect(result).toContain('second');
  });

  it('getQueryRateLimitStatus returns valid status', () => {
    const status = getQueryRateLimitStatus();
    expect(status.remaining).toBeGreaterThanOrEqual(0);
    expect(status.resetIn).toBeGreaterThanOrEqual(0);
  });
});
