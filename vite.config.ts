// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'node:module';
const { grpcBridge } = createRequire(import.meta.url)('./tooling/vite/grpc-bridge.cjs');

export default defineConfig({
  plugins: [react(), grpcBridge()],
  base: './', // Use relative paths in packaged desktop apps
  build: {
    rolldownOptions: {
      output: {
        // Monaco is lazy-loaded, but its editor modules also need bounded chunks.
        // Preserve initialization order when splitting its interdependent modules.
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [{ name: 'monaco', test: /node_modules[\\/]monaco-editor[\\/]/, maxSize: 500_000 }],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Must match Tauri devUrl and the Electron startup URL.
    watch: { ignored: ['**/src-tauri/**'] },
    proxy: {
      // Proxy for second OpenSearch cluster (port 9201)
      // Must come before /opensearch to avoid prefix matching issues
      '/opensearch2': {
        target: 'https://localhost:9201',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path) => path.replace(/^\/opensearch2/, ''),
      },
      // Proxy for third OpenSearch cluster (port 9202)
      '/opensearch3': {
        target: 'https://localhost:9202',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/opensearch3/, ''),
      },
      // Proxy for fourth OpenSearch cluster (port 9203)
      '/opensearch4': {
        target: 'https://localhost:9203',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/opensearch4/, ''),
      },
      // Proxy for first OpenSearch cluster (port 9200) - default
      // Must come last as it's a prefix of the others
      '/opensearch': {
        target: 'https://localhost:9200',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path) => path.replace(/^\/opensearch/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
