// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
};

function createStorage(): StorageLike {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const existing = (globalThis as Record<string, unknown>)[name];
  const hasRequiredMethods =
    !!existing &&
    typeof (existing as StorageLike).getItem === 'function' &&
    typeof (existing as StorageLike).setItem === 'function' &&
    typeof (existing as StorageLike).removeItem === 'function' &&
    typeof (existing as StorageLike).clear === 'function';

  if (!hasRequiredMethods) {
    const storage = createStorage();
    Object.defineProperty(globalThis, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, {
        value: storage,
        configurable: true,
        writable: true,
      });
    }
  }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

if (!globalThis.crypto || typeof globalThis.crypto.subtle === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

if (typeof window !== 'undefined' && (!window.crypto || typeof window.crypto.subtle === 'undefined')) {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: TextEncoder,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextDecoder', {
    value: TextDecoder,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.btoa === 'undefined') {
  Object.defineProperty(globalThis, 'btoa', {
    value: (data: string) => Buffer.from(data, 'binary').toString('base64'),
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.atob === 'undefined') {
  Object.defineProperty(globalThis, 'atob', {
    value: (data: string) => Buffer.from(data, 'base64').toString('binary'),
    configurable: true,
    writable: true,
  });
}
