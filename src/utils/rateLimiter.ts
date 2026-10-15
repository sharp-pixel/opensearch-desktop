// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Rate Limiter Utility for OpenSearch DevTools
 * Prevents excessive API calls that could overwhelm the cluster
 */

import { RATE_LIMIT } from './constants';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Minimum time between requests in milliseconds */
  minIntervalMs?: number;
}

/**
 * Rate limiter state
 */
interface RateLimiterState {
  requests: number[];
  lastRequestTime: number;
}

/**
 * Maximum number of request timestamps to keep (prevents unbounded growth)
 */
const MAX_REQUEST_HISTORY = 1000;

/**
 * Rate limiter result
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remainingRequests: number;
}

/**
 * Simple token bucket rate limiter
 * Tracks request timestamps and enforces rate limits based on a sliding window
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private state: RateLimiterState;

  /**
   * Create a new rate limiter
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      minIntervalMs: config.minIntervalMs ?? 0,
    };
    this.state = {
      requests: [],
      lastRequestTime: 0,
    };
  }

  /**
   * Clean up old requests outside the time window
   * Also enforces maximum array size to prevent memory leaks
   * @private
   */
  private cleanup(): void {
    const now = Date.now();
    this.state.requests = this.state.requests.filter(
      (time) => now - time < this.config.windowMs
    );
    
    // Safety: if array somehow grows too large, keep only recent entries
    if (this.state.requests.length > MAX_REQUEST_HISTORY) {
      this.state.requests = this.state.requests.slice(-this.config.maxRequests);
    }
  }

  /**
   * Attempt to acquire a rate limit token
   * If allowed, records the request and returns success
   * If denied, returns retry information
   * @returns Result indicating if request is allowed and remaining capacity
   */
  tryAcquire(): RateLimitResult {
    const now = Date.now();
    
    // Clean up old requests outside the window
    this.cleanup();

    // Check minimum interval
    if (this.config.minIntervalMs > 0) {
      const timeSinceLastRequest = now - this.state.lastRequestTime;
      if (timeSinceLastRequest < this.config.minIntervalMs) {
        return {
          allowed: false,
          retryAfterMs: this.config.minIntervalMs - timeSinceLastRequest,
          remainingRequests: Math.max(0, this.config.maxRequests - this.state.requests.length),
        };
      }
    }

    // Check if we're at the limit
    if (this.state.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.state.requests[0];
      const retryAfterMs = oldestRequest 
        ? this.config.windowMs - (now - oldestRequest)
        : this.config.windowMs;
      
      return {
        allowed: false,
        retryAfterMs: Math.max(0, retryAfterMs),
        remainingRequests: 0,
      };
    }

    // Record the request
    this.state.requests.push(now);
    this.state.lastRequestTime = now;

    return {
      allowed: true,
      remainingRequests: this.config.maxRequests - this.state.requests.length,
    };
  }

  /**
   * Get current rate limit status without consuming a token
   * Useful for displaying remaining capacity to users
   * @returns Object with remaining requests and time until reset
   */
  getStatus(): { remainingRequests: number; resetInMs: number } {
    // Clean up old requests (prevents memory leak if only getStatus is called)
    this.cleanup();

    const oldestRequest = this.state.requests[0];
    const resetInMs = oldestRequest 
      ? Math.max(0, this.config.windowMs - (Date.now() - oldestRequest))
      : 0;

    return {
      remainingRequests: Math.max(0, this.config.maxRequests - this.state.requests.length),
      resetInMs,
    };
  }

  /**
   * Reset the rate limiter state
   * Clears all tracked requests and allows immediate new requests
   */
  reset(): void {
    this.state = {
      requests: [],
      lastRequestTime: 0,
    };
  }
}

/**
 * Default rate limiter for query execution
 * Uses centralized constants for configuration
 */
export const queryRateLimiter = new RateLimiter({
  maxRequests: RATE_LIMIT.MAX_REQUESTS,
  windowMs: RATE_LIMIT.WINDOW_MS,
  minIntervalMs: RATE_LIMIT.MIN_INTERVAL_MS,
});

/**
 * Check if query execution is rate limited
 * Returns error message if limited, null if allowed
 */
export function checkQueryRateLimit(): string | null {
  const result = queryRateLimiter.tryAcquire();
  
  if (!result.allowed) {
    const retrySeconds = Math.ceil((result.retryAfterMs || 1000) / 1000);
    return `Rate limit exceeded. Please wait ${retrySeconds} second${retrySeconds > 1 ? 's' : ''} before executing another query.`;
  }
  
  return null;
}

/**
 * Get current rate limit status for display
 */
export function getQueryRateLimitStatus(): { remaining: number; resetIn: number } {
  const status = queryRateLimiter.getStatus();
  return {
    remaining: status.remainingRequests,
    resetIn: Math.ceil(status.resetInMs / 1000),
  };
}
