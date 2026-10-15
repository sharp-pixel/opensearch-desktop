// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Grok Processor
 */

import { describe, it, expect } from 'vitest';
import { applyGrok } from '../../services/processors/grok';

describe('Grok Processor Property Tests', () => {
  describe('Basic pattern matching', () => {
    it('Property: matches simple word pattern', () => {
      const event = { message: 'hello world' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD:first} %{WORD:second}'] },
      });
      expect(result.first).toBe('hello');
      expect(result.second).toBe('world');
    });

    it('Property: matches IP address pattern', () => {
      const event = { message: 'Client IP: 192.168.1.100' };
      const result = applyGrok(event, {
        match: { message: ['Client IP: %{IPV4:ip}'] },
      });
      expect(result.ip).toBe('192.168.1.100');
    });

    it('Property: matches number pattern', () => {
      const event = { message: 'Count: 42' };
      const result = applyGrok(event, {
        match: { message: ['Count: %{INT:count}'] },
      });
      expect(result.count).toBe('42');
    });

    it('Property: matches username pattern', () => {
      const event = { message: 'User: john_doe123' };
      const result = applyGrok(event, {
        match: { message: ['User: %{USERNAME:user}'] },
      });
      expect(result.user).toBe('john_doe123');
    });
  });

  describe('Target key', () => {
    it('Property: writes captures to target key', () => {
      const event = { message: 'hello world' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD:first} %{WORD:second}'] },
        target_key: 'parsed',
      });
      expect((result.parsed as any).first).toBe('hello');
      expect((result.parsed as any).second).toBe('world');
    });
  });

  describe('Custom patterns', () => {
    it('Property: uses custom pattern definitions', () => {
      const event = { message: 'Status: OK' };
      const result = applyGrok(event, {
        match: { message: ['Status: %{STATUS:status}'] },
        pattern_definitions: {
          STATUS: 'OK|ERROR|WARN',
        },
      });
      expect(result.status).toBe('OK');
    });
  });

  describe('Break on match', () => {
    it('Property: breaks on first match by default', () => {
      const event = { message: 'hello' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD:first}', '%{GREEDYDATA:all}'] },
      });
      expect(result.first).toBe('hello');
      expect(result.all).toBeUndefined();
    });

    it('Property: continues matching when break_on_match=false', () => {
      const event = { message: 'hello' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD:first}', '%{GREEDYDATA:all}'] },
        break_on_match: false,
      });
      expect(result.first).toBe('hello');
      expect(result.all).toBe('hello');
    });
  });

  describe('Named captures only', () => {
    it('Property: includes anonymous captures when named_captures_only=false', () => {
      const event = { message: 'hello world' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD} %{WORD:second}'] },
        named_captures_only: false,
      });
      expect(result.second).toBe('world');
    });
  });

  describe('Keep empty captures', () => {
    it('Property: keeps empty captures when configured', () => {
      const event = { message: 'hello' };
      const result = applyGrok(event, {
        match: { message: ['%{WORD:first}'] },
        keep_empty_captures: true,
      });
      expect(result.first).toBe('hello');
    });
  });

  describe('Edge cases', () => {
    it('Property: handles missing match config', () => {
      const event = { message: 'hello' };
      const result = applyGrok(event, {} as any);
      expect(result).toEqual(event);
    });

    it('Property: handles non-string field', () => {
      const event = { message: 123 };
      const result = applyGrok(event, {
        match: { message: ['%{INT:num}'] },
      });
      expect(result.num).toBeUndefined();
    });

    it('Property: handles no match', () => {
      const event = { message: 'hello' };
      const result = applyGrok(event, {
        match: { message: ['%{IPV4:ip}'] },
      });
      expect(result.ip).toBeUndefined();
    });

    it('Property: reports unavailable patterns instead of matching arbitrary text', () => {
      const event = { message: 'hello' };
      expect(() => applyGrok(event, {
        match: { message: ['%{UNKNOWN:val}'] },
      })).toThrow('Grok pattern not available');
    });

    it('Property: handles nested field', () => {
      const event = { data: { message: 'hello world' } };
      const result = applyGrok(event, {
        match: { 'data/message': ['%{WORD:first} %{WORD:second}'] },
      });
      expect(result.first).toBe('hello');
      expect(result.second).toBe('world');
    });
  });

  describe('Built-in patterns', () => {
    it('Property: matches TIMESTAMP_ISO8601', () => {
      const event = { message: 'Time: 2024-01-15T10:30:45Z' };
      const result = applyGrok(event, {
        match: { message: ['Time: %{NOTSPACE:timestamp}'] },
      });
      expect(result.timestamp).toBe('2024-01-15T10:30:45Z');
    });

    it('Property: matches LOGLEVEL', () => {
      const event = { message: '[ERROR] Something went wrong' };
      const result = applyGrok(event, {
        match: { message: ['\\[%{LOGLEVEL:level}\\] %{GREEDYDATA:msg}'] },
      });
      expect(result.level).toBe('ERROR');
      expect(result.msg).toBe('Something went wrong');
    });

    it('Property: matches UUID', () => {
      const event = { message: 'ID: 550e8400-e29b-41d4-a716-446655440000' };
      const result = applyGrok(event, {
        match: { message: ['ID: %{UUID:id}'] },
      });
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('Property: matches QUOTEDSTRING', () => {
      const event = { message: 'Name: "John Doe"' };
      const result = applyGrok(event, {
        match: { message: ['Name: %{QUOTEDSTRING:name}'] },
      });
      expect(result.name).toBe('"John Doe"');
    });

    it('Property: matches PATH', () => {
      const event = { message: 'File: /var/log/app.log' };
      const result = applyGrok(event, {
        match: { message: ['File: %{UNIXPATH:path}'] },
      });
      expect(result.path).toBe('/var/log/app.log');
    });
  });
});
