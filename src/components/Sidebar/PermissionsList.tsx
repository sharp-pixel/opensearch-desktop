// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * PermissionsList Component - Displays categorized permissions
 * Requirements: 10.3, 10.4, 5.5
 * 
 * Note: This component is now integrated into TrackingSidebar.
 * Kept for backwards compatibility.
 */

import React from 'react';
import type { CategorizedPermission } from '../../types/tracking';

export interface PermissionsListProps {
  permissions: CategorizedPermission[];
  onClear: () => void;
  clearDisabled?: boolean;
}

/**
 * PermissionsList Component - Now a simple wrapper
 * The main functionality has been moved to TrackingSidebar for better integration
 */
export function PermissionsList(_props: PermissionsListProps): React.ReactElement | null {
  // This component's functionality is now handled by TrackingSidebar
  // Returning null as it's no longer needed as a separate component
  return null;
}

export default PermissionsList;
