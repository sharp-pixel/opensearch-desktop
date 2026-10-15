// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const domainBoundaries = {
  group: ['react', 'react-dom', '**/context/**', '**/components/**', '**/ui/**', '**/platform/**', '**/storage/**'],
  message: 'Domain and execution policy must remain independent of UI, storage and host adapters.',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'release/**',
      'coverage/**',
      'node_modules/**',
      'src-tauri/target/**',
      'src-tauri/gen/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-useless-escape': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'warn'
    }
  },
  ...['notebook', 'investigation', 'dataprepper', 'ism'].flatMap(feature => {
    const featureBoundaries = [
      {
        group: ['notebook', 'investigation', 'dataprepper', 'ism']
          .filter(other => other !== feature).map(other => `**/${other}/**`),
        message: 'Features must not import another feature. Compose them in the app layer or extract a shared capability.',
      },
      { group: ['**/app/**'], message: 'Features must not depend on app composition.' },
    ];
    return [
      {
        files: [`src/features/${feature}/**/*.{ts,tsx}`],
        rules: { 'no-restricted-imports': ['error', { patterns: featureBoundaries }] },
      },
      {
        files: [`src/features/${feature}/domain/**/*.{ts,tsx}`],
        rules: {
          'no-restricted-imports': ['error', { patterns: [...featureBoundaries, domainBoundaries] }],
          'no-restricted-globals': ['error', 'localStorage', 'sessionStorage', 'fetch', 'window', 'document'],
        },
      },
      {
        files: [`src/features/${feature}/application/**/*.{ts,tsx}`, `src/features/${feature}/state/**/*.{ts,tsx}`],
        rules: {
          'no-restricted-imports': ['error', { patterns: [...featureBoundaries, {
            group: ['react', 'react-dom', '**/components/**', '**/context/**', '**/ui/**'],
            message: 'Application workflows and stores must not depend on React components or providers.',
          }] }],
        },
      },
    ];
  }),
  {
    files: ['src/execution/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [domainBoundaries] }],
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage', 'fetch', 'window', 'document'],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/context/**/*.{ts,tsx}', 'src/connections/**/*.{ts,tsx}', 'src/editor/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        regex: '^(?:\\.{1,2}/)+(?:[^/]+/)*(?:features|app)/|^@/(?:features|app)/',
        message: 'Shared capabilities must not depend on feature implementations or app composition.',
      }] }],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.commonjs,
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['src/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off'
    }
  }
);
