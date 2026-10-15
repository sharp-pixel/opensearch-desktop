// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for AWS Profiles Utility
 * Tests isElectron, getAwsProfiles, getAwsProfileCredentials, refreshAwsProfiles, isAwsProfileSupportAvailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

describe('AWS Profiles Utility Tests', () => {
  // Store original window
  const originalWindow = global.window;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore window
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('isElectron', () => {
    it('returns false when window is undefined', async () => {
      // @ts-expect-error - intentionally setting to undefined
      global.window = undefined;
      
      const { isElectron } = await import('../../utils/awsProfiles');
      expect(isElectron()).toBe(false);
    });

    it('returns false when electronAPI is not present', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { isElectron } = await import('../../utils/awsProfiles');
      expect(isElectron()).toBe(false);
    });

    it('returns false when electronAPI.isElectron is false', async () => {
      global.window = {
        electronAPI: {
          isElectron: false,
        },
      } as unknown as Window & typeof globalThis;
      
      const { isElectron } = await import('../../utils/awsProfiles');
      expect(isElectron()).toBe(false);
    });

    it('returns true when electronAPI.isElectron is true', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { isElectron } = await import('../../utils/awsProfiles');
      expect(isElectron()).toBe(true);
    });
  });

  describe('isAwsProfileSupportAvailable', () => {
    it('returns false in browser environment', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { isAwsProfileSupportAvailable } = await import('../../utils/awsProfiles');
      expect(isAwsProfileSupportAvailable()).toBe(false);
    });

    it('returns true in Electron environment', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { isAwsProfileSupportAvailable } = await import('../../utils/awsProfiles');
      expect(isAwsProfileSupportAvailable()).toBe(true);
    });
  });

  describe('getAwsProfiles', () => {
    it('returns empty array in browser environment', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { getAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await getAwsProfiles();
      expect(profiles).toEqual([]);
    });

    it('returns profiles from Electron API', async () => {
      const mockProfiles = [
        { name: 'default', region: 'us-east-1' },
        { name: 'production', region: 'us-west-2' },
      ];
      
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn().mockResolvedValue(mockProfiles),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { getAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await getAwsProfiles();
      expect(profiles).toEqual(mockProfiles);
    });

    it('returns empty array on error', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn().mockRejectedValue(new Error('Failed')),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { getAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await getAwsProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('getAwsProfileCredentials', () => {
    it('returns null in browser environment', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { getAwsProfileCredentials } = await import('../../utils/awsProfiles');
      const creds = await getAwsProfileCredentials('default');
      expect(creds).toBeNull();
    });

    it('returns credentials from Electron API', async () => {
      const mockCreds = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        sessionToken: 'token123',
        region: 'us-east-1',
      };
      
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn().mockResolvedValue(mockCreds),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { getAwsProfileCredentials } = await import('../../utils/awsProfiles');
      const creds = await getAwsProfileCredentials('default');
      expect(creds).toEqual(mockCreds);
    });

    it('returns null on error', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn().mockRejectedValue(new Error('Failed')),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { getAwsProfileCredentials } = await import('../../utils/awsProfiles');
      const creds = await getAwsProfileCredentials('default');
      expect(creds).toBeNull();
    });

    it('Property: any profile name is handled', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn().mockResolvedValue(null),
            refreshProfiles: vi.fn(),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { getAwsProfileCredentials } = await import('../../utils/awsProfiles');
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (profileName) => {
            const creds = await getAwsProfileCredentials(profileName);
            expect(creds).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('refreshAwsProfiles', () => {
    it('returns empty array in browser environment', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { refreshAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await refreshAwsProfiles();
      expect(profiles).toEqual([]);
    });

    it('returns refreshed profiles from Electron API', async () => {
      const mockProfiles = [
        { name: 'default', region: 'us-east-1' },
        { name: 'new-profile', region: 'eu-west-1' },
      ];
      
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn().mockResolvedValue(mockProfiles),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { refreshAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await refreshAwsProfiles();
      expect(profiles).toEqual(mockProfiles);
    });

    it('returns empty array on error', async () => {
      global.window = {
        electronAPI: {
          isElectron: true,
          aws: {
            getProfiles: vi.fn(),
            getProfileCredentials: vi.fn(),
            refreshProfiles: vi.fn().mockRejectedValue(new Error('Failed')),
          },
        },
      } as unknown as Window & typeof globalThis;
      
      const { refreshAwsProfiles } = await import('../../utils/awsProfiles');
      const profiles = await refreshAwsProfiles();
      expect(profiles).toEqual([]);
    });
  });
});
