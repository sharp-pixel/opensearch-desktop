// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ISM Policy Persistence Service
 * Handles saving, loading, and exporting ISM policies
 */

import type { SavedPolicy } from '../types/ism';

const STORAGE_KEY = 'ism-analyzer-policy';
const RECENT_KEY = 'ism-analyzer-recent';
const MAX_RECENT = 10;

/**
 * Save the current policy to local storage
 */
export function savePolicy(policy: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, policy);
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Load the saved policy from local storage
 */
export function loadPolicy(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Export policy as a downloadable Blob
 */
export function exportPolicy(policy: string): Blob {
  return new Blob([policy], { type: 'application/json' });
}

/**
 * Import policy from a file
 * Returns the policy JSON string or throws an error
 */
export async function importPolicy(file: File): Promise<string> {
  const text = await file.text();
  
  // Validate JSON
  try {
    JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`, { cause: e });
  }
  
  return text;
}

/**
 * Get list of recent policies
 */
export function getRecentPolicies(): SavedPolicy[] {
  try {
    const saved = localStorage.getItem(RECENT_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore errors
  }
  return [];
}

/**
 * Add a policy to the recent history
 */
export function addToHistory(policy: string, name: string): void {
  try {
    const recent = getRecentPolicies();
    
    // Create new entry
    const newEntry: SavedPolicy = {
      id: `policy-${Date.now()}`,
      name,
      policy,
      timestamp: Date.now(),
    };
    
    // Remove duplicates (same policy content)
    const filtered = recent.filter(p => p.policy !== policy);
    
    // Add new entry at the beginning
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);
    
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear the recent history
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Remove a specific policy from history
 */
export function removeFromHistory(id: string): void {
  try {
    const recent = getRecentPolicies();
    const filtered = recent.filter(p => p.id !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore errors
  }
}

/**
 * Get a policy from history by ID
 */
export function getPolicyFromHistory(id: string): SavedPolicy | null {
  const recent = getRecentPolicies();
  return recent.find(p => p.id === id) || null;
}

/**
 * Download a policy as a JSON file
 */
export function downloadPolicy(policy: string, filename: string = 'ism-policy.json'): void {
  const blob = exportPolicy(policy);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy policy to clipboard
 */
export async function copyPolicyToClipboard(policy: string): Promise<void> {
  await navigator.clipboard.writeText(policy);
}

/**
 * Format policy JSON with proper indentation
 */
export function formatPolicy(policy: string): string {
  try {
    const parsed = JSON.parse(policy);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return policy; // Return as-is if not valid JSON
  }
}

/**
 * Minify policy JSON (remove whitespace)
 */
export function minifyPolicy(policy: string): string {
  try {
    const parsed = JSON.parse(policy);
    return JSON.stringify(parsed);
  } catch {
    return policy;
  }
}

/**
 * Extract policy name from JSON
 */
export function extractPolicyName(policy: string): string {
  try {
    const parsed = JSON.parse(policy);
    if (parsed.policy?.policy_id) {
      return parsed.policy.policy_id;
    }
    if (parsed.policy?.description) {
      // Use first few words of description
      return parsed.policy.description.split(' ').slice(0, 3).join(' ');
    }
  } catch {
    // Ignore errors
  }
  return 'Untitled Policy';
}

/**
 * Validate that a string is valid ISM policy JSON
 */
export function isValidPolicyJson(policy: string): boolean {
  try {
    const parsed = JSON.parse(policy);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'policy' in parsed &&
      typeof parsed.policy === 'object' &&
      parsed.policy !== null &&
      'states' in parsed.policy &&
      Array.isArray(parsed.policy.states)
    );
  } catch {
    return false;
  }
}

/**
 * Create a file input element for importing policies
 */
export function createFileInput(onFileSelect: (file: File) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';
  
  input.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so the same file can be selected again
    target.value = '';
  });
  
  return input;
}
