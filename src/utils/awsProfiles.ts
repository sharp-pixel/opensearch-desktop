// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * AWS Profile Utilities
 * Provides access to AWS credentials from ~/.aws/credentials and ~/.aws/config
 * Only works in Electron environment
 */

import type { AwsProfile, AwsProfileCredentials } from '../types/connection';
import { createLogger } from './logger';

const logger = createLogger('AwsProfiles');

import { nativeAPI, isDesktopApp } from '../platform/runtime';
export { isElectron } from '../platform/runtime';

/**
 * Get list of available AWS profiles
 * @returns Array of profile information (without credentials), empty array if not in Electron or on error
 */
export async function getAwsProfiles(): Promise<AwsProfile[]> {
  if (!isDesktopApp()) {
    return [];
  }
  
  try {
    return await nativeAPI.aws.getProfiles();
  } catch (error) {
    logger.error('Failed to get AWS profiles:', error);
    return [];
  }
}

/**
 * Get credentials for a specific AWS profile
 * @param profileName - Name of the profile to get credentials for
 * @returns Credentials or null if not found or not in Electron
 */
export async function getAwsProfileCredentials(profileName: string): Promise<AwsProfileCredentials | null> {
  if (!isDesktopApp()) {
    return null;
  }
  
  try {
    return await nativeAPI.aws.getProfileCredentials(profileName);
  } catch (error) {
    logger.error(`Failed to get credentials for profile "${profileName}":`, error);
    return null;
  }
}

/**
 * Refresh the list of AWS profiles (re-read from disk)
 * @returns Updated array of profile information, empty array if not in Electron or on error
 */
export async function refreshAwsProfiles(): Promise<AwsProfile[]> {
  if (!isDesktopApp()) {
    return [];
  }
  
  try {
    return await nativeAPI.aws.refreshProfiles();
  } catch (error) {
    logger.error('Failed to refresh AWS profiles:', error);
    return [];
  }
}

/**
 * Check if AWS profile support is available
 * @returns true if AWS profile support is available (running in Electron)
 */
export function isAwsProfileSupportAvailable(): boolean {
  return isDesktopApp();
}
