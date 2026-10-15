// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { nativeAPI } from '../platform/runtime';

const PREFIX = 'opensearch-workbench:vault-reference:';
const validReference = /^keyring:[a-fA-F0-9-]{1,100}$/;

/** Persist only opaque references, before writing any secret to the native vault. */
export function rememberVaultReference(reference: string): void {
  if (!validReference.test(reference)) throw new Error('Invalid native secret reference');
  localStorage.setItem(PREFIX + reference, '1');
}

export async function deleteVaultReference(reference: string): Promise<void> {
  if (!validReference.test(reference)) throw new Error('Invalid native secret reference');
  await nativeAPI.safeStorage.delete(reference);
  localStorage.removeItem(PREFIX + reference);
}

/** Call only inside the cross-window connection lock, with validated committed metadata. */
export async function reconcileVaultReferences(active: ReadonlySet<string>): Promise<void> {
  const references: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX)) {
      const reference = key.slice(PREFIX.length);
      if (validReference.test(reference)) references.push(reference);
    }
  }
  // Do not sweep the OS vault: only entries created and journaled by this workspace qualify.
  for (const reference of references) {
    if (!active.has(reference)) await deleteVaultReference(reference);
  }
}

export function credentialReferences(json: string | null): string[] {
  if (json === null) return [];
  const credentials: unknown = JSON.parse(json);
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new Error('Invalid saved credentials');
  }
  return Object.entries(credentials).flatMap(([field, value]) => {
    if (!field.startsWith('__encrypted_') || typeof value !== 'string' || !value.startsWith('tv:')) return [];
    const reference = value.slice(3);
    if (!validReference.test(reference)) throw new Error('Invalid saved secret reference');
    return [reference];
  });
}
