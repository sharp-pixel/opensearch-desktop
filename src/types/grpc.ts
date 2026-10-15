// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export interface GrpcTransportRequest {
  endpoint: string;
  method: 'Search' | 'Bulk';
  payload: string; // Base64 Protobuf bytes across the native bridge
  authorization?: string;
}

export interface GrpcTransportResponse {
  code: number;
  // Tauri serializes Rust's optional fields as null; Node omits them.
  payload?: string | null;
  error?: string | null;
}
