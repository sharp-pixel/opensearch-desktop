// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Query Executor Service for OpenSearch Notebook
 * Handles HTTP request construction and execution against OpenSearch
 * Requirements: 2.1, 2.2, 2.3, 2.6, 4.4
 */

import type { ConnectionConfig, SigV4Credentials } from '../types/connection';
import type { QueryCell, QueryResult, HttpMethod, PPLResult, PPLColumn } from '../types/cell';
import { generateAuthHeaders } from '../utils/authHeaders';
import { signRequest, fetchAwsProfileCredentials, type SigV4Headers } from '../utils/sigv4';
import { validateJson } from '../utils/jsonValidator';
import { ApiTracker } from './apiTracker';
import { NETWORK, HTTP_STATUS } from '../utils/constants';
import { secureFetch, isDesktopApp } from '../platform/runtime';
import { requestScope } from '../platform/cancellation';

/**
 * Query execution options
 */
export interface ExecuteOptions {
  timeout?: number;
  signal?: AbortSignal;
  tracker?: ApiTracker;
}

/**
 * Connection validation result
 */
export interface ConnectionValidationResult {
  valid: boolean;
  error?: string;
  clusterName?: string;
  clusterStatus?: string;
  certificateUrl?: string; // URL to open for accepting self-signed certificates
}

/**
 * Result of SigV4 header generation - success case
 */
interface SigV4Success {
  success: true;
  headers: SigV4Headers;
}

/**
 * Result of SigV4 header generation - failure case
 */
interface SigV4Failure {
  success: false;
  error: string;
}

/**
 * Result of SigV4 header generation
 */
type SigV4Result = SigV4Success | SigV4Failure;

/**
 * Generate SigV4 headers for a request
 * Centralizes the SigV4 signing logic to avoid duplication
 */
async function generateSigV4Headers(
  config: ConnectionConfig,
  method: HttpMethod,
  url: string,
  body: string = ''
): Promise<SigV4Result> {
  if (config.authType !== 'sigv4' || !config.credentials) {
    return { success: false, error: 'SigV4 auth not configured' };
  }

  let sigv4Creds = config.credentials as SigV4Credentials;

  // If using AWS profile, fetch credentials from ~/.aws/credentials
  if (sigv4Creds.useAwsProfile && sigv4Creds.awsProfileName) {
    const profileCreds = await fetchAwsProfileCredentials(sigv4Creds.awsProfileName);
    if (!profileCreds) {
      return {
        success: false,
        error: `Failed to load credentials from AWS profile "${sigv4Creds.awsProfileName}". Make sure the profile exists in ~/.aws/credentials.`,
      };
    }
    sigv4Creds = {
      ...sigv4Creds,
      accessKeyId: profileCreds.accessKeyId,
      secretAccessKey: profileCreds.secretAccessKey,
      sessionToken: profileCreds.sessionToken,
      // Use profile region if not explicitly set
      region: sigv4Creds.region || profileCreds.region || sigv4Creds.region,
    };
  }

  const headers = await signRequest(method, url, sigv4Creds, body);
  return { success: true, headers };
}

/**
 * Execute a query against an OpenSearch cluster
 * Requirements: 2.1, 2.2, 2.3, 2.6
 * 
 * @param config - Connection configuration
 * @param cell - Query cell to execute
 * @param options - Execution options
 * @returns Query result with response or error
 */
export async function execute(
  config: ConnectionConfig,
  cell: QueryCell,
  options: ExecuteOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  
  // Check if credentials are required but missing
  if (config.authType !== 'none' && !config.credentials) {
    return {
      success: false,
      statusCode: 0,
      body: {
        error: 'Authentication required',
        type: 'CredentialsError',
        details: 'Please configure connection credentials in the connection settings.',
      },
      duration: Date.now() - startTime,
      executedAt: Date.now(),
    };
  }
  
  try {
    // Build the full URL
    const url = buildUrl(config.endpoint, cell.endpoint, config.useProxy);
    
    // Prepare body
    let body = '';
    if (!shouldIncludeBody(cell.method) && cell.body.trim()) {
      return {
        success: false, statusCode: 0,
        body: { error: `${cell.method} requests cannot send a body. Choose a supported method such as POST to send this query.` },
        duration: Date.now() - startTime, executedAt: Date.now(),
      };
    }
    const isNdjson = /\/(?:_bulk(?:\/stream)?|_msearch(?:\/template)?)\/?$/.test(cell.endpoint.split('?')[0] || '');
    if (shouldIncludeBody(cell.method) && cell.body && cell.body.trim()) {
      // Validate JSON body before sending
      const validation = isNdjson ? validateNdjson(cell.body) : validateJson(cell.body);
      if (!validation.valid) {
        return {
          success: false,
          statusCode: 0,
          body: {
            error: 'Invalid JSON body',
            details: validation.error?.message,
            location: validation.error?.line 
              ? `Line ${validation.error.line}, Column ${validation.error.column}`
              : undefined,
          },
          duration: Date.now() - startTime,
          executedAt: Date.now(),
        };
      }
      body = isNdjson && !cell.body.endsWith('\n') ? `${cell.body}\n` : cell.body;
    }
    
    // Generate headers based on auth type
    let headers: Record<string, string> = generateAuthHeaders(config);
    if (isNdjson) headers['Content-Type'] = 'application/x-ndjson';
    
    // Handle SigV4 signing for AWS OpenSearch Service/Serverless
    if (config.authType === 'sigv4' && config.credentials) {
      const sigv4Result = await generateSigV4Headers(config, cell.method, url, body);
      if (!sigv4Result.success) {
        return {
          success: false,
          statusCode: 0,
          body: {
            error: 'Failed to fetch instance role credentials',
            type: 'CredentialsError',
            details: sigv4Result.error,
          },
          duration: Date.now() - startTime,
          executedAt: Date.now(),
        };
      }
      headers = { ...headers, ...sigv4Result.headers };
    }
    
    // Build request options
    const requestOptions: RequestInit = {
      method: cell.method,
      headers,
    };
    
    // Add body for methods that support it
    if (body) {
      requestOptions.body = body;
    }
    
    const scope = requestScope(options.timeout, options.signal);
    requestOptions.signal = scope.signal;
    
    try {
      // Execute the request (use secureFetch for self-signed cert support in Electron)
      const response = await secureFetch(url, requestOptions);
      
      // Parse response
      const responseBody = await parseResponse(response);
      
      // Track the operation if tracker is provided
      if (options.tracker) {
        options.tracker.trackOperation(cell.method, cell.endpoint, cell.id);
      }
      
      const duration = Date.now() - startTime;
      
      return {
        success: response.ok,
        statusCode: response.status,
        body: responseBody,
        duration,
        executedAt: Date.now(),
      };
    } finally {
      scope.dispose();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const url = buildUrl(config.endpoint, cell.endpoint, config.useProxy);
    
    return {
      success: false,
      statusCode: 0,
      body: extractErrorInfo(error, url),
      duration,
      executedAt: Date.now(),
    };
  }
}

/**
 * Validate a connection by executing a cluster health check
 * Requirements: 4.4
 * 
 * @param config - Connection configuration to validate
 * @returns Validation result
 */
export async function validateConnection(
  config: ConnectionConfig
): Promise<ConnectionValidationResult> {
  // Check if credentials are required but missing
  if (config.authType !== 'none' && !config.credentials) {
    return {
      valid: false,
      error: 'Authentication credentials are required. Please configure them in connection settings.',
    };
  }
  
  try {
    const url = buildUrl(config.endpoint, '/_cluster/health', config.useProxy);
    let headers: Record<string, string> = generateAuthHeaders(config);
    
    // Handle SigV4 signing
    if (config.authType === 'sigv4' && config.credentials) {
      const sigv4Result = await generateSigV4Headers(config, 'GET', url, '');
      if (!sigv4Result.success) {
        return {
          valid: false,
          error: sigv4Result.error,
        };
      }
      headers = { ...headers, ...sigv4Result.headers };
    }
    
    const response = await secureFetch(url, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorBody = await parseResponse(response);
      return {
        valid: false,
        error: getErrorMessage(response.status, errorBody),
      };
    }
    
    const body = await response.json();
    
    return {
      valid: true,
      clusterName: body.cluster_name,
      clusterStatus: body.status,
    };
  } catch (error) {
    const url = buildUrl(config.endpoint, '/_cluster/health', config.useProxy);
    const errorMessage = extractErrorMessage(error, url);
    
    // Check if this might be an SSL certificate issue
    if (url.startsWith('https://') && error instanceof TypeError) {
      return {
        valid: false,
        error: errorMessage,
        certificateUrl: url,
      };
    }
    
    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Build the full URL from endpoint and path
 * If useProxy is true and endpoint is localhost, use the Vite proxy
 * Note: Proxy is only used in browser dev mode, not in desktop apps (Electron/Tauri)
 */
function buildUrl(baseEndpoint: string, path: string, useProxy?: boolean): string {
  // Remove trailing slash from base endpoint
  const base = baseEndpoint.replace(/\/+$/, '');
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Check if we should use the proxy for localhost
  // Only use proxy in browser (not in Electron/Tauri which handle SSL natively)
  if (useProxy && !isDesktopApp()) {
    try {
      const url = new URL(base);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        // Map different ports to different proxy endpoints
        // Default port 9200 -> /opensearch
        // Port 9201 -> /opensearch2
        // etc.
        const port = url.port || '9200';
        const proxyPath = getProxyPathForPort(port);
        return `${proxyPath}${normalizedPath}`;
      }
    } catch {
      // Invalid URL, fall through to normal handling
    }
  }
  
  return `${base}${normalizedPath}`;
}

/**
 * Get the proxy path for a given port
 * Maps localhost ports to Vite proxy endpoints
 */
function getProxyPathForPort(port: string): string {
  const proxyMap: Record<string, string> = {
    '9200': '/opensearch',
    '9201': '/opensearch2',
    '9202': '/opensearch3',
    '9203': '/opensearch4',
  };
  return proxyMap[port] || `/opensearch-${port}`;
}

/**
 * Determine if the HTTP method should include a body
 */
function shouldIncludeBody(method: HttpMethod): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function validateNdjson(body: string): ReturnType<typeof validateJson> {
  const lines = body.trimEnd().split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const validation = validateJson(lines[index]!);
    if (!validation.valid) {
      return { ...validation, error: { ...validation.error!, line: index + 1 } };
    }
  }
  return { valid: true };
}

/**
 * Parse the response body
 */
async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    
    // Try to parse as JSON anyway (OpenSearch sometimes doesn't set content-type)
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Extract error information from an exception
 */
function extractErrorInfo(error: unknown, url?: string): { error: string; type: string; details?: string; certificateUrl?: string } {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Check if this might be an SSL certificate issue
    if (url && url.startsWith('https://')) {
      return {
        error: 'Connection failed',
        type: 'NetworkError',
        details: 'Unable to connect. This may be due to an untrusted SSL certificate. Try opening the URL in a new tab to accept the certificate.',
        certificateUrl: url,
      };
    }
    return {
      error: 'Network error',
      type: 'NetworkError',
      details: 'Unable to connect to the OpenSearch cluster. Please check the endpoint URL and network connectivity.',
    };
  }
  
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      error: 'Request timeout',
      type: 'TimeoutError',
      details: 'The request took too long to complete.',
    };
  }
  
  if (error instanceof Error) {
    return {
      error: error.message,
      type: error.name,
    };
  }
  
  return {
    error: 'Unknown error',
    type: 'UnknownError',
    details: String(error),
  };
}

/**
 * Extract error message from an exception, with URL context for better error messages
 */
function extractErrorMessage(error: unknown, url?: string): string {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    if (url && url.startsWith('https://')) {
      return 'Unable to connect. This may be due to an untrusted SSL certificate. Click the link below to accept the certificate in your browser.';
    }
    return 'Unable to connect to the OpenSearch cluster. Please check the endpoint URL and network connectivity.';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Unknown error occurred';
}

/**
 * Get a user-friendly error message based on status code
 */
function getErrorMessage(statusCode: number, body: unknown): string {
  switch (statusCode) {
    case HTTP_STATUS.UNAUTHORIZED:
      return 'Authentication failed. Please check your credentials.';
    case HTTP_STATUS.FORBIDDEN:
      return 'Access denied. You do not have permission to access this resource.';
    case HTTP_STATUS.NOT_FOUND:
      return 'Resource not found. Please check the endpoint URL.';
    case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      return 'Internal server error. The OpenSearch cluster encountered an error.';
    case HTTP_STATUS.BAD_GATEWAY:
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return 'Service unavailable. The OpenSearch cluster may be down or overloaded.';
    default:
      if (body && typeof body === 'object' && 'error' in body) {
        const errorObj = body as { error: unknown };
        if (typeof errorObj.error === 'string') {
          return errorObj.error;
        }
        if (typeof errorObj.error === 'object' && errorObj.error !== null) {
          const nestedError = errorObj.error as { reason?: string; type?: string };
          if (nestedError.reason) {
            return nestedError.reason;
          }
          if (nestedError.type) {
            return `Error: ${nestedError.type}`;
          }
        }
      }
      return `Request failed with status ${statusCode}`;
  }
}

/**
 * Query Executor class for managing query execution
 */
export class QueryExecutor {
  private tracker: ApiTracker | null = null;
  private defaultTimeout: number = NETWORK.DEFAULT_TIMEOUT_MS;

  /**
   * Set the API tracker for operation tracking
   */
  setTracker(tracker: ApiTracker): void {
    this.tracker = tracker;
  }

  /**
   * Set the default timeout for requests
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Execute a query
   */
  async execute(
    config: ConnectionConfig,
    cell: QueryCell,
    options: ExecuteOptions = {}
  ): Promise<QueryResult> {
    return execute(config, cell, {
      timeout: options.timeout ?? this.defaultTimeout,
      tracker: options.tracker ?? this.tracker ?? undefined,
    });
  }

  /**
   * Validate a connection
   */
  async validateConnection(config: ConnectionConfig): Promise<ConnectionValidationResult> {
    return validateConnection(config);
  }
}

/**
 * Create a new query executor instance
 */
export function createQueryExecutor(): QueryExecutor {
  return new QueryExecutor();
}

/**
 * Index information from the cluster
 */
export interface IndexInfo {
  name: string;
  health: string;
  status: string;
  docsCount: number;
}

/**
 * Fetch index names from the OpenSearch cluster
 * Requirements: 3.9 - Endpoint autocomplete with cluster indices
 * 
 * @param config - Connection configuration
 * @returns Array of index information or empty array on error
 */
export async function fetchClusterIndices(
  config: ConnectionConfig
): Promise<IndexInfo[]> {
  const results: IndexInfo[] = [];
  
  try {
    // Fetch regular indices
    const indicesUrl = buildUrl(config.endpoint, '/_cat/indices?format=json', config.useProxy);
    let headers: Record<string, string> = generateAuthHeaders(config);
    
    // Handle SigV4 signing
    if (config.authType === 'sigv4' && config.credentials) {
      const sigv4Result = await generateSigV4Headers(config, 'GET', indicesUrl, '');
      if (!sigv4Result.success) {
        return [];
      }
      headers = { ...headers, ...sigv4Result.headers };
    }
    
    const indicesResponse = await secureFetch(indicesUrl, {
      method: 'GET',
      headers,
    });
    
    if (indicesResponse.ok) {
      const body = await indicesResponse.json();
      
      if (Array.isArray(body)) {
        const indices = body.map((index: Record<string, unknown>) => ({
          name: String(index.index || ''),
          health: String(index.health || 'unknown'),
          status: String(index.status || 'unknown'),
          docsCount: parseInt(String(index['docs.count'] || '0'), 10) || 0,
        })).filter((index: IndexInfo) => 
          index.name.length > 0 && !index.name.startsWith('.')
        );
        results.push(...indices);
      }
    }
    
    // Fetch data streams
    try {
      const dataStreamsUrl = buildUrl(config.endpoint, '/_data_stream', config.useProxy);
      let dsHeaders: Record<string, string> = generateAuthHeaders(config);
      
      if (config.authType === 'sigv4' && config.credentials) {
        const sigv4Result = await generateSigV4Headers(config, 'GET', dataStreamsUrl, '');
        if (sigv4Result.success) {
          dsHeaders = { ...dsHeaders, ...sigv4Result.headers };
        }
      }
      
      const dsResponse = await secureFetch(dataStreamsUrl, {
        method: 'GET',
        headers: dsHeaders,
      });
      
      if (dsResponse.ok) {
        const dsBody = await dsResponse.json();
        
        if (dsBody.data_streams && Array.isArray(dsBody.data_streams)) {
          const dataStreams = dsBody.data_streams.map((ds: Record<string, unknown>) => ({
            name: String(ds.name || ''),
            health: String(ds.status || 'unknown'),
            status: 'open',
            docsCount: 0,
          })).filter((ds: IndexInfo) => 
            ds.name.length > 0 && !ds.name.startsWith('.')
          );
          results.push(...dataStreams);
        }
      }
    } catch {
      // Data streams endpoint might not be available, ignore errors
    }
    
    return results;
  } catch {
    return [];
  }
}


/**
 * PPL execution options
 */
export interface PPLExecuteOptions {
  timeout?: number;
  signal?: AbortSignal;
  tracker?: ApiTracker;
}

/**
 * Execute a PPL query against an OpenSearch cluster
 * Requirements: PPL 2.1, 2.2, 2.3
 * 
 * @param config - Connection configuration
 * @param query - PPL query string
 * @param cellId - Cell ID for tracking
 * @param options - Execution options
 * @returns PPL result with response or error
 */
export async function executePPL(
  config: ConnectionConfig,
  query: string,
  cellId: string,
  options: PPLExecuteOptions = {}
): Promise<PPLResult> {
  const startTime = Date.now();
  
  // Check if credentials are required but missing
  if (config.authType !== 'none' && !config.credentials) {
    return {
      success: false,
      statusCode: 0,
      schema: [],
      datarows: [],
      total: 0,
      size: 0,
      duration: Date.now() - startTime,
      executedAt: Date.now(),
      error: 'Authentication credentials are required. Please configure them in connection settings.',
    };
  }
  
  // Validate PPL syntax before sending to server
  const syntaxError = validatePPLSyntax(query);
  if (syntaxError) {
    return {
      success: false,
      statusCode: 0,
      schema: [],
      datarows: [],
      total: 0,
      size: 0,
      duration: Date.now() - startTime,
      executedAt: Date.now(),
      error: syntaxError,
    };
  }
  
  try {
    // Build the PPL endpoint URL
    const url = buildUrl(config.endpoint, '/_plugins/_ppl', config.useProxy);
    
    // Prepare the request body
    const body = JSON.stringify({ query });
    
    // Generate headers based on auth type
    let headers: Record<string, string> = {
      ...generateAuthHeaders(config),
      'Content-Type': 'application/json',
    };
    
    // Handle SigV4 signing for AWS OpenSearch Service/Serverless
    if (config.authType === 'sigv4' && config.credentials) {
      const sigv4Result = await generateSigV4Headers(config, 'POST', url, body);
      if (!sigv4Result.success) {
        return {
          success: false,
          statusCode: 0,
          schema: [],
          datarows: [],
          total: 0,
          size: 0,
          duration: Date.now() - startTime,
          executedAt: Date.now(),
          error: sigv4Result.error,
        };
      }
      headers = { ...headers, ...sigv4Result.headers };
    }
    
    // Build request options
    const requestOptions: RequestInit = {
      method: 'POST',
      headers,
      body,
    };
    
    const scope = requestScope(options.timeout, options.signal);
    requestOptions.signal = scope.signal;
    
    try {
      // Execute the request (use secureFetch for self-signed cert support in Electron)
      const response = await secureFetch(url, requestOptions);
      
      // Parse response
      const responseBody = await response.json();
      
      // Track the operation if tracker is provided
      if (options.tracker) {
        const indexPattern = extractPPLIndex(query);
        options.tracker.trackPPLOperation(query, cellId, indexPattern);
      }
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        // Extract error message from PPL error response
        const errorMessage = extractPPLError(responseBody);
        return {
          success: false,
          statusCode: response.status,
          schema: [],
          datarows: [],
          total: 0,
          size: 0,
          duration,
          executedAt: Date.now(),
          error: errorMessage,
        };
      }
      
      // Parse successful PPL response
      const schema: PPLColumn[] = (responseBody.schema || []).map((col: { name: string; type: string }) => ({
        name: col.name,
        type: col.type,
      }));
      
      return {
        success: true,
        statusCode: response.status,
        schema,
        datarows: responseBody.datarows || [],
        total: responseBody.total || 0,
        size: responseBody.size || 0,
        duration,
        executedAt: Date.now(),
      };
    } finally {
      scope.dispose();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      statusCode: 0,
      schema: [],
      datarows: [],
      total: 0,
      size: 0,
      duration,
      executedAt: Date.now(),
      error: extractErrorMessage(error),
    };
  }
}

/**
 * Extract index name from PPL query
 * Requirements: PPL 6.2
 * 
 * @param query - PPL query string
 * @returns Index name or null if not found
 */
export function extractPPLIndex(query: string): string | null {
  const match = query.match(/source\s*=\s*([^\s|]+)/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Extract error message from PPL error response
 */
function extractPPLError(body: unknown): string {
  if (body && typeof body === 'object') {
    const errorBody = body as Record<string, unknown>;
    
    // PPL error format: { error: { reason: "...", type: "...", details: "..." } }
    if (errorBody.error && typeof errorBody.error === 'object') {
      const error = errorBody.error as Record<string, unknown>;
      
      // Build comprehensive error message
      const parts: string[] = [];
      
      if (error.type) {
        parts.push(`Type: ${error.type}`);
      }
      if (error.reason) {
        parts.push(`Reason: ${error.reason}`);
      }
      if (error.details) {
        parts.push(`Details: ${error.details}`);
      }
      
      // Check for root_cause array
      if (Array.isArray(error.root_cause) && error.root_cause.length > 0) {
        const rootCause = error.root_cause[0] as Record<string, unknown>;
        if (rootCause.reason && !parts.some(p => p.includes(String(rootCause.reason)))) {
          parts.push(`Root cause: ${rootCause.reason}`);
        }
      }
      
      // Check for caused_by
      if (error.caused_by && typeof error.caused_by === 'object') {
        const causedBy = error.caused_by as Record<string, unknown>;
        if (causedBy.reason) {
          parts.push(`Caused by: ${causedBy.reason}`);
        }
      }
      
      if (parts.length > 0) {
        return parts.join('\n');
      }
      
      // Fallback: stringify the error object
      return JSON.stringify(error, null, 2);
    }
    
    // Alternative format: { message: "..." }
    if (errorBody.message) {
      return String(errorBody.message);
    }
    
    // Alternative format: { error: "..." }
    if (typeof errorBody.error === 'string') {
      return errorBody.error;
    }
    
    // Alternative format: { status: ..., error: { ... } } from OpenSearch
    if (errorBody.status && errorBody.error) {
      return `Status ${errorBody.status}: ${JSON.stringify(errorBody.error, null, 2)}`;
    }
    
    // Last resort: stringify the whole body
    return JSON.stringify(body, null, 2);
  }
  
  return 'Unknown PPL error';
}


/**
 * Validate PPL query syntax before sending to server
 * Returns error message if invalid, null if valid
 */
export function validatePPLSyntax(query: string): string | null {
  if (!query.trim()) {
    return 'PPL query cannot be empty. Start with: source=<index>';
  }
  // PPL grammar and available commands vary by server version. Let the cluster
  // validate nonempty queries instead of rejecting valid syntax locally.
  return null;
}
