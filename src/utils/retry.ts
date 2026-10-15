// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Retry Utility for OpenSearch DevTools
 * Provides retry logic with exponential backoff for transient failures
 */

import { NETWORK, RETRYABLE_STATUS_CODES } from './constants';
import { createLogger } from './logger';

const logger = createLogger('Retry');

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs?: number;
  /** Whether to use exponential backoff (true) or fixed delay (false) */
  exponentialBackoff?: boolean;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback invoked before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
}

/**
 * Default retry options
 */
const defaultOptions: Required<RetryOptions> = {
  maxAttempts: NETWORK.MAX_RETRY_ATTEMPTS,
  baseDelayMs: NETWORK.RETRY_BASE_DELAY_MS,
  maxDelayMs: NETWORK.RETRY_MAX_DELAY_MS,
  exponentialBackoff: true,
  isRetryable: isTransientError,
  onRetry: () => {},
};

/**
 * Calculate delay for a given attempt using exponential backoff with jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  if (!options.exponentialBackoff) {
    return options.baseDelayMs;
  }
  
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt);
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  
  // Clamp to maxDelay
  return Math.min(exponentialDelay + jitter, options.maxDelayMs);
}

/**
 * Check if an error is a transient/retryable error
 */
export function isTransientError(error: unknown): boolean {
  // Network errors (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Timeout errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  
  // HTTP response errors with retryable status codes
  if (error instanceof Response) {
    return RETRYABLE_STATUS_CODES.includes(error.status as typeof RETRYABLE_STATUS_CODES[number]);
  }
  
  // Custom error with status property
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return RETRYABLE_STATUS_CODES.includes(status as typeof RETRYABLE_STATUS_CODES[number]);
  }
  
  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result containing success status, data or error, and attempt count
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts: Required<RetryOptions> = { ...defaultOptions, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const isLastAttempt = attempt === opts.maxAttempts - 1;
      const shouldRetry = !isLastAttempt && opts.isRetryable(error);
      
      if (!shouldRetry) {
        logger.debug(`Not retrying: ${isLastAttempt ? 'max attempts reached' : 'error not retryable'}`);
        break;
      }
      
      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, opts);
      logger.debug(`Retry attempt ${attempt + 1}/${opts.maxAttempts} after ${delayMs}ms`);
      opts.onRetry(attempt + 1, error, delayMs);
      
      await sleep(delayMs);
    }
  }
  
  return { success: false, error: lastError, attempts: opts.maxAttempts };
}

/**
 * Wrap a fetch call with retry logic
 * 
 * @param url - URL to fetch
 * @param init - Fetch init options
 * @param retryOptions - Retry configuration options
 * @returns Fetch response
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const result = await withRetry(async () => {
    const response = await fetch(url, init);
    
    // Throw response for retryable status codes so retry logic can handle it
    if (!response.ok && RETRYABLE_STATUS_CODES.includes(response.status as typeof RETRYABLE_STATUS_CODES[number])) {
      throw response;
    }
    
    return response;
  }, {
    ...retryOptions,
    isRetryable: (error) => {
      // Check if it's a Response with retryable status
      if (error instanceof Response) {
        return RETRYABLE_STATUS_CODES.includes(error.status as typeof RETRYABLE_STATUS_CODES[number]);
      }
      return isTransientError(error);
    },
  });
  
  if (!result.success) {
    // If the last error was a Response, return it
    if (result.error instanceof Response) {
      return result.error;
    }
    throw result.error;
  }
  
  return result.data!;
}
