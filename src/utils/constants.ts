// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Application Constants
 * Centralizes magic numbers and configuration values
 */

import { isDesktopApp } from './platform';

/**
 * Application branding
 */
export const APP = {
  /** Full application name */
  NAME: 'OpenSearch Developer Workbench',
  /** Short name for constrained spaces (desktop apps hide title in toolbar) */
  get DISPLAY_NAME(): string {
    return isDesktopApp() ? '' : 'OpenSearch Developer Workbench';
  },
  /** Whether to show the title in the toolbar */
  get SHOW_TITLE(): boolean {
    return !isDesktopApp();
  },
} as const;

/**
 * HTTP/Network related constants
 */
export const NETWORK = {
  /** Default timeout for API requests in milliseconds */
  DEFAULT_TIMEOUT_MS: 30000,
  /** Connection validation timeout in milliseconds */
  VALIDATION_TIMEOUT_MS: 10000,
  /** Maximum retry attempts for transient failures */
  MAX_RETRY_ATTEMPTS: 3,
  /** Base delay for exponential backoff in milliseconds */
  RETRY_BASE_DELAY_MS: 1000,
  /** Maximum delay between retries in milliseconds */
  RETRY_MAX_DELAY_MS: 10000,
} as const;

/**
 * Rate limiting constants
 */
export const RATE_LIMIT = {
  /** Maximum requests allowed in the time window */
  MAX_REQUESTS: 30,
  /** Time window for rate limiting in milliseconds */
  WINDOW_MS: 10000,
  /** Minimum interval between requests in milliseconds */
  MIN_INTERVAL_MS: 100,
} as const;

/**
 * UI/Display constants
 */
export const UI = {
  /** Toast notification display duration in milliseconds */
  TOAST_DURATION_MS: 5000,
  /** Debounce delay for search/filter inputs in milliseconds */
  DEBOUNCE_DELAY_MS: 300,
  /** Animation duration for transitions in milliseconds */
  ANIMATION_DURATION_MS: 200,
  /** Maximum items to show in autocomplete dropdown */
  AUTOCOMPLETE_MAX_ITEMS: 50,
} as const;

/**
 * Storage constants
 */
export const STORAGE = {
  /** Prefix for all localStorage keys */
  KEY_PREFIX: 'opensearch-notebook',
  /** Maximum size for a single localStorage item (approximate, in characters) */
  MAX_ITEM_SIZE: 5000000,
  /** Default connection ID */
  DEFAULT_CONNECTION_ID: 'local-docker-opensearch',
} as const;

/**
 * Editor constants
 */
export const EDITOR = {
  /** Default editor height in pixels */
  DEFAULT_HEIGHT_PX: 200,
  /** Minimum editor height in pixels */
  MIN_HEIGHT_PX: 100,
  /** Maximum editor height in pixels */
  MAX_HEIGHT_PX: 600,
  /** Tab size for code formatting */
  TAB_SIZE: 2,
  /** Font size for code editor in pixels */
  FONT_SIZE_PX: 13,
} as const;

/**
 * Pagination constants
 */
export const PAGINATION = {
  /** Default page size for result tables */
  DEFAULT_PAGE_SIZE: 25,
  /** Available page size options */
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const,
} as const;

/**
 * HTTP status codes for common checks
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Retryable HTTP status codes
 */
export const RETRYABLE_STATUS_CODES = [
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
] as const;
