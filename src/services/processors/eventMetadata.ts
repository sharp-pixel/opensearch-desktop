// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { EventProcessingMetadata } from '../../types/dataPrepper';

// Metadata is separate from event data. Keep it out of body JSON and field walks.
const metadataKey = Symbol('processingMetadata');
type MetadataEvent = Record<string, unknown> & { [metadataKey]?: EventProcessingMetadata };

export function peekEventMetadata(event: object): EventProcessingMetadata | undefined {
  return (event as MetadataEvent)[metadataKey];
}

export function attachEventMetadata<T extends object>(event: T, metadata: EventProcessingMetadata): T {
  Object.defineProperty(event, metadataKey, { value: metadata, writable: true, configurable: true });
  return event;
}

export function detachEventMetadata<T extends object>(event: T): T {
  delete (event as MetadataEvent)[metadataKey];
  return event;
}

/** List element conditions see the parent event's metadata. */
export function inheritEventMetadata<T extends object>(context: T, event: Record<string, unknown>): T {
  const metadata = peekEventMetadata(event);
  return metadata ? attachEventMetadata(context, metadata) : context;
}

export function getEventMetadata(event: Record<string, unknown>): EventProcessingMetadata {
  const existing = peekEventMetadata(event);
  if (existing) return existing;
  const metadata = { attributes: Object.create(null) as Record<string, unknown>, tags: [] as string[] };
  attachEventMetadata(event, metadata);
  return metadata;
}

export function addEventTags(event: Record<string, unknown>, tags: string[] = []): void {
  if (!tags.length) return;
  const metadata = getEventMetadata(event);
  metadata.tags = [...new Set([...metadata.tags, ...tags])];
}

/** Attribute lookup follows DefaultEventMetadata's map traversal, not JSON Pointer decoding. */
export function getMetadataAttribute(event: Record<string, unknown>, attribute: string): unknown {
  let key = attribute.startsWith('/') ? attribute.slice(1) : attribute;
  let map = peekEventMetadata(event)?.attributes;
  if (!map) return null;
  if (key.includes('/')) {
    const keys = key.split('/');
    while (keys[keys.length - 1] === '') keys.pop();
    for (let i = 0; i < keys.length - 1; i++) {
      const value: unknown = Object.prototype.hasOwnProperty.call(map, keys[i]!) ? map[keys[i]!] : null;
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
      map = value as Record<string, unknown>;
      key = keys[i + 1]!;
    }
  }
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] ?? null : null;
}
