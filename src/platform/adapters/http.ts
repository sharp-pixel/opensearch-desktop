// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export function createResponseFromResult(
  result: { status: number; statusText: string; body: unknown; headers?: Record<string, string>; error?: string },
  method?: string,
): Response {
  if (result.error || result.status === 0) throw new TypeError(result.error || 'Network request failed');
  if (!Number.isInteger(result.status) || result.status < 200 || result.status > 599) throw new TypeError('Invalid transport response');
  const headers = new Headers(result.headers);
  const body = method === 'HEAD' || [204, 205, 304].includes(result.status) ? null
    : typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
  return new Response(body, { status: result.status, statusText: result.statusText, headers });
}

export function isLocalHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch { return false; }
}
