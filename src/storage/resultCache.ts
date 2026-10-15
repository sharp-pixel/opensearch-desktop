// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Keep at most two inactive, clean result documents in memory. Disk results are retained. */
export const INACTIVE_RESULT_CACHE_LIMIT = 2;

export function createResultCache(canEvict: (id: string) => boolean, evict: (id: string) => void) {
  const recent = new Set<string>();
  return {
    touch(id: string) { recent.delete(id); recent.add(id); },
    remove(id: string) { recent.delete(id); },
    trim() {
      const candidates = [...recent].filter(canEvict);
      for (const id of candidates.slice(0, Math.max(0, candidates.length - INACTIVE_RESULT_CACHE_LIMIT))) {
        evict(id); recent.delete(id);
      }
    },
  };
}
