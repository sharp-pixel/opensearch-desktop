// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { describe, expect, it } from 'vitest';
import { dump } from 'js-yaml';
import { simulatePipeline } from '../../services/pipelineSimulator';

// Source-derived contracts from Data Prepper 0c8acd7ff (2.17.0-SNAPSHOT).
// See docs/dataprepper-simulator-validation.md for upstream classes and limitations.
type Event = Record<string, unknown>;
type Case = { name: string; processor: string; config: Event; input: Event; output: Event };

const cases: Case[] = [
  { name: 'add list values resolve against elements by default', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value_expression: '/name' }] }, input: { name: 'root', items: [{ name: 'Ada' }, { name: 'Bob' }] }, output: { name: 'root', items: [{ name: 'Ada', copy: 'Ada' }, { name: 'Bob', copy: 'Bob' }] } },
  { name: 'add list formats can resolve against the root', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', format: '${/name}', disable_root_keys: false }] }, input: { name: 'root', items: [{ name: 'Ada' }, { name: 'Bob' }] }, output: { name: 'root', items: [{ name: 'Ada', copy: 'root' }, { name: 'Bob', copy: 'root' }] } },
  { name: 'add list formats resolve against each element by default', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', format: 'Hello ${/name}' }] }, input: { name: 'root', items: [{ name: 'Ada' }, {}] }, output: { name: 'root', items: [{ name: 'Ada', copy: 'Hello Ada' }, { copy: 'Hello ' }] } },
  { name: 'add list expressions can resolve against the root', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value_expression: '/name', disable_root_keys: false }] }, input: { name: 'root', items: [{ name: 'Ada' }] }, output: { name: 'root', items: [{ name: 'Ada', copy: 'root' }] } },
  { name: 'add list condition sees the root by default', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'added', value: true, add_to_element_when: '/enabled == true' }] }, input: { enabled: true, items: [{ enabled: false }] }, output: { enabled: true, items: [{ enabled: false, added: true }] } },
  { name: 'add list false root condition skips all elements', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'added', value: true, add_to_element_when: '/enabled == true' }] }, input: { enabled: false, items: [{ enabled: true }] }, output: { enabled: false, items: [{ enabled: true }] } },
  { name: 'add list conditions can select individual elements', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'added', value: true, add_to_element_when: '/enabled == true', evaluate_when_on_element: true }] }, input: { enabled: false, items: [{ enabled: true }, { enabled: false }] }, output: { enabled: false, items: [{ enabled: true, added: true }, { enabled: false }] } },
  { name: 'add_when sees the root before list conditions', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'added', value: true, add_when: '/enabled == true', add_to_element_when: '/enabled == true', evaluate_when_on_element: true }] }, input: { enabled: false, items: [{ enabled: true }] }, output: { enabled: false, items: [{ enabled: true }] } },
  { name: 'add list uses literal slash keys by default', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'a/b', value: 1 }] }, input: { items: [{}] }, output: { items: [{ 'a/b': 1 }] } },
  { name: 'add list can write nested paths', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'a/b', value: 1, flatten_key: false }] }, input: { items: [{}] }, output: { items: [{ a: { b: 1 } }] } },
  { name: 'add list preserves existing null keys by default', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value: 1 }] }, input: { items: [{ copy: null }, {}] }, output: { items: [{ copy: null }, { copy: 1 }] } },
  { name: 'add list explicitly overwrites existing keys', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value: 1, overwrite_if_key_exists: true }] }, input: { items: [{ copy: 2 }] }, output: { items: [{ copy: 1 }] } },
  { name: 'add list appends scalar and list values without flattening', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value: [2, 3], append_if_key_exists: true }] }, input: { items: [{ copy: 1 }, { copy: [1] }] }, output: { items: [{ copy: [1, [2, 3]] }, { copy: [1, [2, 3]] }] } },
  { name: 'add list raw key existence differs from nested path existence', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'a/b', value: 2, flatten_key: false }] }, input: { items: [{ a: { b: 1 } }] }, output: { items: [{ a: { b: 2 } }] } },
  { name: 'add list raw key blocks nested writes without overwrite', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'a/b', value: 2, flatten_key: false }] }, input: { items: [{ 'a/b': 1, a: { b: 3 } }] }, output: { items: [{ 'a/b': 1, a: { b: 3 } }] } },
  { name: 'add list missing source leaves the event unchanged', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value: 1 }] }, input: { id: 1 }, output: { id: 1 } },
  { name: 'add list empty source remains empty', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value: 1 }] }, input: { items: [] }, output: { items: [] } },
  { name: 'add list entries see previous element writes', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'first', value: 1 }, { iterate_on: 'items', key: 'second', value_expression: '/first' }] }, input: { items: [{}] }, output: { items: [{ first: 1, second: 1 }] } },
  { name: 'add dynamic keys resolve fields', processor: 'add_entries', config: { entries: [{ key: '${/field}', value: 1 }] }, input: { field: 'result' }, output: { field: 'result', result: 1 } },
  { name: 'add dynamic keys combine root fields', processor: 'add_entries', config: { entries: [{ key: '${/first}-${/second}', value: 1 }] }, input: { first: 'result', second: 'value' }, output: { first: 'result', second: 'value', 'result-value': 1 } },
  { name: 'add dynamic keys can be nested paths', processor: 'add_entries', config: { entries: [{ key: '${/field}', value: 1 }] }, input: { field: 'result/value' }, output: { field: 'result/value', result: { value: 1 } } },
  { name: 'add dynamic keys preserve resolved destination values', processor: 'add_entries', config: { entries: [{ key: '${/field}', value: 1 }] }, input: { field: 'result', result: 2 }, output: { field: 'result', result: 2 } },
  { name: 'add dynamic list keys see root while values see elements', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: '${/field}', value_expression: '/name' }] }, input: { field: 'copy', items: [{ field: 'local', name: 'Ada' }] }, output: { field: 'copy', items: [{ field: 'local', name: 'Ada', copy: 'Ada' }] } },
  { name: 'add dynamic keys resolve against earlier root writes', processor: 'add_entries', config: { entries: [{ key: 'field', value: 'result' }, { key: '${/field}', value: 1 }] }, input: {}, output: { field: 'result', result: 1 } },
  { name: 'add formats null fields as empty strings', processor: 'add_entries', config: { entries: [{ key: 'formatted', format: '<${/value}>' }] }, input: { value: null }, output: { value: null, formatted: '<>' } },
  { name: 'add formats collection values like Java collections', processor: 'add_entries', config: { entries: [{ key: 'formatted', format: '${/items} ${/data}' }] }, input: { items: [1, null, 'x'], data: { a: true } }, output: { items: [1, null, 'x'], data: { a: true }, formatted: '[1, null, x] {a=true}' } },
  { name: 'add missing value expressions write null', processor: 'add_entries', config: { entries: [{ key: 'copy', value_expression: '/missing' }] }, input: {}, output: { copy: null } },
  { name: 'add list missing value expressions write null', processor: 'add_entries', config: { entries: [{ iterate_on: 'items', key: 'copy', value_expression: '/missing' }] }, input: { items: [{}] }, output: { items: [{ copy: null }] } },
  { name: 'copy projects lists and preserves unmatched positions', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'name', to_key: 'label' }] }, input: { items: [{ name: 'Ada', id: 1 }, { id: 2 }] }, output: { items: [{ name: 'Ada', id: 1 }, { id: 2 }], copied: [{ label: 'Ada' }, {}] } },
  { name: 'copy list keys are literal rather than nested paths', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'a/b', to_key: 'x/y' }] }, input: { items: [{ 'a/b': 1, a: { b: 2 } }] }, output: { items: [{ 'a/b': 1, a: { b: 2 } }], copied: [{ 'x/y': 1 }] } },
  { name: 'copy list predicates see the root event', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'name', to_key: 'label', copy_when: '/enabled == true' }] }, input: { enabled: true, items: [{ name: 'Ada', enabled: false }] }, output: { enabled: true, items: [{ name: 'Ada', enabled: false }], copied: [{ label: 'Ada' }] } },
  { name: 'copy list preserves an existing target by default', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'name', to_key: 'label' }] }, input: { items: [{ name: 'Ada' }], copied: null }, output: { items: [{ name: 'Ada' }], copied: null } },
  { name: 'copy list explicitly replaces an existing target', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', overwrite_if_to_list_exists: true, entries: [{ from_key: 'name', to_key: 'label' }] }, input: { items: [{ name: 'Ada' }], copied: [{ old: true }] }, output: { items: [{ name: 'Ada' }], copied: [{ label: 'Ada' }] } },
  { name: 'copy absent list retains the event', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'name', to_key: 'label' }] }, input: { id: 1 }, output: { id: 1 } },
  { name: 'copy empty list writes an empty list', processor: 'copy_values', config: { from_list: 'items', to_list: 'copied', entries: [{ from_key: 'name', to_key: 'label' }] }, input: { items: [] }, output: { items: [], copied: [] } },
  { name: 'rename lowercases maps but leaves list elements unchanged', processor: 'rename_keys', config: { transform_key: 'lowercase' }, input: { User: { DisplayName: 'Ada' }, Items: [{ DisplayName: 'Bob' }] }, output: { user: { displayname: 'Ada' }, items: [{ DisplayName: 'Bob' }] } },
  { name: 'rename capitalizes only the first character', processor: 'rename_keys', config: { transform_key: 'capitalize' }, input: { displayNAME: 'Ada' }, output: { DisplayNAME: 'Ada' } },
  { name: 'rename uppercase transforms nested keys', processor: 'rename_keys', config: { transform_key: 'uppercase' }, input: { user: { name: 'Ada' } }, output: { USER: { NAME: 'Ada' } } },
  { name: 'rename regex matches whole root keys only', processor: 'rename_keys', config: { entries: [{ from_key_regex: 'field_[0-9]+', to_key: 'value' }] }, input: { field_1: 1, prefix_field_2: 2, nested: { field_3: 3 } }, output: { value: 1, prefix_field_2: 2, nested: { field_3: 3 } } },
  { name: 'rename regex preserves an existing target by default', processor: 'rename_keys', config: { entries: [{ from_key_regex: 'old', to_key: 'value' }] }, input: { old: 1, value: null }, output: { old: 1, value: null } },
  { name: 'rename regex explicitly overwrites the target', processor: 'rename_keys', config: { entries: [{ from_key_regex: 'old', to_key: 'value', overwrite_if_to_key_exists: true }] }, input: { old: 1, value: 2 }, output: { value: 1 } },
  { name: 'rename writes a descendant before removing its source', processor: 'rename_keys', config: { entries: [{ from_key: 'a', to_key: 'a/b' }] }, input: { a: 1 }, output: {} },
  { name: 'delete regex excludes configured root keys and does not recurse', processor: 'delete_entries', config: { with_keys_regex: ['secret.*'], exclude_from_delete: ['secretKeep'] }, input: { secret: 1, secretKeep: 2, public: { secret: 3 } }, output: { secretKeep: 2, public: { secret: 3 } } },
  { name: 'delete regex is anchored and backtracks across alternatives', processor: 'delete_entries', config: { with_keys_regex: ['a|abc'] }, input: { a: 1, abc: 2, abcd: 3, xa: 4 }, output: { abcd: 3, xa: 4 } },
  { name: 'delete root predicate sees root and element predicate sees each item', processor: 'delete_entries', config: { with_keys: ['secret'], iterate_on: 'items', delete_when: '/enabled == true', delete_from_element_when: '/remove == true' }, input: { enabled: true, items: [{ secret: 1, remove: true }, { secret: 2, remove: false }] }, output: { enabled: true, items: [{ remove: true }, { secret: 2, remove: false }] } },
  { name: 'delete entries apply in sequence', processor: 'delete_entries', config: { entries: [{ with_keys: ['first'] }, { with_keys: ['second'], delete_when: '/first == null' }] }, input: { first: 1, second: 2, keep: 3 }, output: { keep: 3 } },
  { name: 'delete regex works within list elements', processor: 'delete_entries', config: { entries: [{ with_keys_regex: ['private.*'], iterate_on: 'items' }] }, input: { items: [{ privateID: 1, name: 'Ada' }, { name: 'Bob' }] }, output: { items: [{ name: 'Ada' }, { name: 'Bob' }] } },
  { name: 'key_value overwrite replaces the whole destination', processor: 'key_value', config: { destination_conflict_strategy: 'overwrite' }, input: { message: 'a=new&b=2', parsed_message: { a: 'old', keep: 1 } }, output: { message: 'a=new&b=2', parsed_message: { a: 'new', b: '2' } } },
  { name: 'key_value skip preserves the whole destination', processor: 'key_value', config: { destination_conflict_strategy: 'skip' }, input: { message: 'a=new&b=2', parsed_message: { a: 'old', keep: 1 } }, output: { message: 'a=new&b=2', parsed_message: { a: 'old', keep: 1 } } },
  { name: 'key_value merge preserve retains conflicting keys including null', processor: 'key_value', config: { destination_conflict_strategy: 'merge_preserve_existing_keys' }, input: { message: 'a=new&b=2', parsed_message: { a: null, keep: 1 } }, output: { message: 'a=new&b=2', parsed_message: { a: null, keep: 1, b: '2' } } },
  { name: 'key_value merge overwrite retains nonconflicting keys', processor: 'key_value', config: { destination: 'parsed/data', destination_conflict_strategy: 'merge_overwrite_existing_keys' }, input: { message: 'a=new&b=2', parsed: { data: { a: 'old', keep: 1 } } }, output: { message: 'a=new&b=2', parsed: { data: { a: 'new', keep: 1, b: '2' } } } },
  { name: 'key_value merge preserve retains non-map destinations', processor: 'key_value', config: { destination_conflict_strategy: 'merge_preserve_existing_keys' }, input: { message: 'a=1', parsed_message: 'old' }, output: { message: 'a=1', parsed_message: 'old' } },
  { name: 'key_value merge overwrite replaces non-map destinations', processor: 'key_value', config: { destination_conflict_strategy: 'merge_overwrite_existing_keys' }, input: { message: 'a=1', parsed_message: null }, output: { message: 'a=1', parsed_message: { a: '1' } } },
  { name: 'key_value skip at root still adds absent fields', processor: 'key_value', config: { destination: null, destination_conflict_strategy: 'skip' }, input: { message: 'a=new&b=2', a: 'old' }, output: { message: 'a=new&b=2', a: 'old', b: '2' } },
  { name: 'key_value empty destination merges at root', processor: 'key_value', config: { destination: '', destination_conflict_strategy: 'merge_overwrite_existing_keys' }, input: { message: 'a=new&b=2', a: 'old' }, output: { message: 'a=new&b=2', a: 'new', b: '2' } },
  { name: 'key_value capitalize preserves the remaining case', processor: 'key_value', config: { transform_key: 'capitalize' }, input: { message: 'displayNAME=Ada' }, output: { message: 'displayNAME=Ada', parsed_message: { DisplayNAME: 'Ada' } } },
  { name: 'add preserves existing values by default', processor: 'add_entries', config: { entries: [{ key: 'key', value: 'new' }] }, input: { key: 'old' }, output: { key: 'old' } },
  { name: 'add preserves null fields', processor: 'add_entries', config: { entries: [{ key: 'key', value: 'new' }] }, input: { key: null }, output: { key: null } },
  { name: 'add explicitly overwrites', processor: 'add_entries', config: { entries: [{ key: 'key', value: 'new', overwrite_if_key_exists: true }] }, input: { key: 'old' }, output: { key: 'new' } },
  { name: 'add value is literal', processor: 'add_entries', config: { entries: [{ key: 'text', value: '${name}' }] }, input: { name: 'Ada' }, output: { name: 'Ada', text: '${name}' } },
  { name: 'add evaluates numeric value expressions', processor: 'add_entries', config: { entries: [{ key: 'value', value_expression: '123' }] }, input: {}, output: { value: 123 } },
  { name: 'add formats fields', processor: 'add_entries', config: { entries: [{ key: 'text', format: 'Hello ${/user/name}' }] }, input: { user: { name: 'Ada' } }, output: { user: { name: 'Ada' }, text: 'Hello Ada' } },
  { name: 'add appends without flattening the new list', processor: 'add_entries', config: { entries: [{ key: 'items', value: [2, 3], append_if_key_exists: true }] }, input: { items: [1] }, output: { items: [1, [2, 3]] } },
  { name: 'copy preserves destination by default', processor: 'copy_values', config: { entries: [{ from_key: 'a', to_key: 'b' }] }, input: { a: 1, b: 2 }, output: { a: 1, b: 2 } },
  { name: 'copy explicitly overwrites', processor: 'copy_values', config: { entries: [{ from_key: 'a', to_key: 'b', overwrite_if_to_key_exists: true }] }, input: { a: 1, b: 2 }, output: { a: 1, b: 1 } },
  { name: 'slash paths work without a leading slash', processor: 'copy_values', config: { entries: [{ from_key: 'user/name', to_key: 'result/name' }] }, input: { user: { name: 'Ada' } }, output: { user: { name: 'Ada' }, result: { name: 'Ada' } } },
  { name: 'dots are literal field names', processor: 'rename_keys', config: { entries: [{ from_key: 'a.b', to_key: 'c.d' }] }, input: { 'a.b': 1, a: { b: 2 } }, output: { 'c.d': 1, a: { b: 2 } } },
  { name: 'JSON pointer tokens are decoded', processor: 'copy_values', config: { entries: [{ from_key: '/a~1b/~0name', to_key: 'copied' }] }, input: { 'a/b': { '~name': 3 } }, output: { 'a/b': { '~name': 3 }, copied: 3 } },
  { name: 'delete uses nested slash paths', processor: 'delete_entries', config: { with_keys: ['user/name'] }, input: { user: { name: 'Ada', id: 1 } }, output: { user: { id: 1 } } },
  { name: 'parse writes a nested destination', processor: 'parse_json', config: { destination: 'parsed/data' }, input: { message: '{"x":1}' }, output: { message: '{"x":1}', parsed: { data: { x: 1 } } } },
  { name: 'parse pointer retains the final field name', processor: 'parse_json', config: { pointer: '/data/value' }, input: { message: '{"data":{"value":42}}' }, output: { message: '{"data":{"value":42}}', value: 42 } },
  { name: 'parse pointer into a destination retains field name', processor: 'parse_json', config: { pointer: '/data/value', destination: 'parsed' }, input: { message: '{"data":{"value":42}}' }, output: { message: '{"data":{"value":42}}', parsed: { value: 42 } } },
  { name: 'parse pointer root conflict retains full dotted pointer', processor: 'parse_json', config: { pointer: '/data/value' }, input: { message: '{"data":{"value":42}}', value: 'old' }, output: { message: '{"data":{"value":42}}', value: 'old', 'data.value': 42 } },
  { name: 'parse array pointer uses dotted index key', processor: 'parse_json', config: { pointer: '/items/1', destination: 'parsed' }, input: { message: '{"items":[10,20]}' }, output: { message: '{"items":[10,20]}', parsed: { 'items.1': 20 } } },
  { name: 'parse depth does not stringify arrays', processor: 'parse_json', config: { depth: 1 }, input: { message: '{"items":[{"nested":1}],"map":{"nested":2}}' }, output: { message: '{"items":[{"nested":1}],"map":{"nested":2}}', items: [{ nested: 1 }], map: '{"nested":2}' } },
  { name: 'parse root deletes source before merging', processor: 'parse_json', config: { delete_source: true }, input: { message: '{"message":"parsed"}' }, output: { message: 'parsed' } },
  { name: 'parse non-object without destination retains source', processor: 'parse_json', config: { delete_source: true }, input: { message: '[1,2]' }, output: { message: '[1,2]' } },
  { name: 'parse JSON null passes through unchanged', processor: 'parse_json', config: { destination: 'value', delete_source: true }, input: { message: 'null' }, output: { message: 'null' } },
  { name: 'csv writes values and deletes header and source', processor: 'csv', config: { column_names_source_key: 'header', delete_source: true }, input: { header: 'name,note', message: 'Ada,"hello, world"' }, output: { name: 'Ada', note: 'hello, world' } },
  { name: 'csv falls back to configured names when header is absent', processor: 'csv', config: { column_names_source_key: 'missing', column_names: ['name'] }, input: { message: 'Ada,42' }, output: { message: 'Ada,42', name: 'Ada', column2: '42' } },
  { name: 'flatten writes a target and empties the processed source', processor: 'flatten', config: { source: 'data', target: 'flat', remove_processed_fields: true }, input: { data: { a: { b: 1 } }, id: 7 }, output: { data: {}, flat: { 'a.b': 1 }, id: 7 } },
  { name: 'flatten honors aliases and separator', processor: 'flatten', config: { source: 'data', target: 'flat', remove_source_keys: true, remove_list_elements: true, remove_brackets: true, flatten_separator: '_' }, input: { data: { a: [{ b: 1 }, { b: 2 }] } }, output: { data: {}, flat: { a_b: [1, 2] } } },
  { name: 'flatten preserves excluded fields in the source', processor: 'flatten', config: { source: 'data', target: 'flat', remove_processed_fields: true, exclude_keys: ['keep'] }, input: { data: { keep: { x: 1 }, nested: { keep: 2 } } }, output: { data: { keep: { x: 1 } }, flat: { 'nested.keep': 2 } } },
  { name: 'split removes trailing empty elements', processor: 'split_string', config: { entries: [{ source: 'message', delimiter: ',' }] }, input: { message: 'a,b,,' }, output: { message: ['a', 'b'] } },
  { name: 'split discards captured delimiters', processor: 'split_string', config: { entries: [{ source: 'message', delimiter_regex: '(,)' }] }, input: { message: 'a,b' }, output: { message: ['a', 'b'] } },
  { name: 'split retains an empty input', processor: 'split_string', config: { entries: [{ source: 'message', delimiter: ',' }] }, input: { message: '' }, output: { message: [''] } },
  { name: 'substitute stores replaced text', processor: 'substitute_string', config: { entries: [{ source: 'message', from: 'world', to: 'Ada' }] }, input: { message: 'hello world' }, output: { message: 'hello Ada' } },
  { name: 'substitute uses Java capture references', processor: 'substitute_string', config: { entries: [{ source: 'message', from: '(a)(b)', to: '$2$1' }] }, input: { message: 'ab ab' }, output: { message: 'ba ba' } },
  { name: 'substitute uses Java group zero', processor: 'substitute_string', config: { entries: [{ source: 'message', from: 'a', to: '<$0>' }] }, input: { message: 'a' }, output: { message: '<a>' } },
  { name: 'substitute uses Java named groups', processor: 'substitute_string', config: { entries: [{ source: 'message', from: '(?<word>hello)', to: '${word}!' }] }, input: { message: 'hello' }, output: { message: 'hello!' } },
  { name: 'substitute escapes a literal dollar', processor: 'substitute_string', config: { entries: [{ source: 'message', from: 'a', to: '\\$' }] }, input: { message: 'a' }, output: { message: '$' } },
  { name: 'truncate uses start and length', processor: 'truncate', config: { entries: [{ source_keys: ['message'], start_at: 6, length: 5 }] }, input: { message: 'hello,world,no-truncate' }, output: { message: 'world' } },
  { name: 'truncate recursive option traverses maps', processor: 'truncate', config: { entries: [{ source_keys: ['data'], length: 3, recursive: true }] }, input: { data: { message: 'hello' } }, output: { data: { message: 'hel' } } },
  { name: 'truncate empty source list processes nothing', processor: 'truncate', config: { entries: [{ source_keys: [], length: 3 }] }, input: { message: 'hello' }, output: { message: 'hello' } },
  { name: 'truncate out-of-range start stops processing', processor: 'truncate', config: { entries: [{ source_keys: ['message'], start_at: 20 }, { source_keys: ['message'], length: 1 }] }, input: { message: 'hello' }, output: { message: 'hello' } },
  { name: 'obfuscate writes the masked field', processor: 'obfuscate', config: { source: 'message', action: { mask: {} } }, input: { message: 'secret' }, output: { message: '***' } },
  { name: 'key_value writes the parsed destination', processor: 'key_value', config: {}, input: { message: 'a=1&b=2' }, output: { message: 'a=1&b=2', parsed_message: { a: '1', b: '2' } } },
  { name: 'key_value preserves lenient whitespace', processor: 'key_value', config: {}, input: { message: 'a = 1' }, output: { message: 'a = 1', parsed_message: { 'a ': ' 1' } } },
  { name: 'key_value trims strict whitespace', processor: 'key_value', config: { whitespace: 'strict' }, input: { message: 'a = 1' }, output: { message: 'a = 1', parsed_message: { a: '1' } } },
  { name: 'key_value ignores unmatched entries by default', processor: 'key_value', config: {}, input: { message: 'unmatched&a=1' }, output: { message: 'unmatched&a=1', parsed_message: { a: '1' } } },
  { name: 'grok writes captures into target', processor: 'grok', config: { match: { message: ['%{WORD:name}'] }, target_key: 'parsed' }, input: { message: 'hello' }, output: { message: 'hello', parsed: { name: 'hello' } } },
  { name: 'grok merges existing capture values by default', processor: 'grok', config: { match: { message: ['%{WORD:name}'] } }, input: { message: 'hello', name: 'old' }, output: { message: 'hello', name: ['old', 'hello'] } },
  { name: 'grok overwrites configured capture keys', processor: 'grok', config: { match: { message: ['%{WORD:name}'] }, keys_to_overwrite: ['name'] }, input: { message: 'hello', name: 'old' }, output: { message: 'hello', name: 'hello' } },
  { name: 'grok writes an empty target when nothing matches', processor: 'grok', config: { match: { message: ['%{NUMBER:value}'] }, target_key: 'parsed' }, input: { message: 'hello', parsed: { old: true } }, output: { message: 'hello', parsed: {} } },
];

function run(input: Event, processor: string, config: Event) {
  return simulatePipeline(JSON.stringify(input), 'json', dump({ test: { processor: [{ [processor]: config }] } }));
}

describe('Data Prepper source-derived processor contracts', () => {
  it.each([
    ['preserves metadata by default', [{ metadata_key: 'count', value: 1 }, { metadata_key: 'count', value: 2 }], { count: 1 }],
    ['explicitly overwrites metadata', [{ metadata_key: 'count', value: 1 }, { metadata_key: 'count', value: 2, overwrite_if_key_exists: true }], { count: 2 }],
    ['appends metadata scalars', [{ metadata_key: 'count', value: 1 }, { metadata_key: 'count', value: 2, append_if_key_exists: true }], { count: [1, 2] }],
    ['appends metadata without flattening incoming lists', [{ metadata_key: 'count', value: [1] }, { metadata_key: 'count', value: [2, 3], append_if_key_exists: true }], { count: [1, [2, 3]] }],
    ['preserves existing null metadata', [{ metadata_key: 'count', value_expression: 'null' }, { metadata_key: 'count', value: 1 }], { count: null }],
    ['appends to existing null metadata', [{ metadata_key: 'count', value_expression: 'null' }, { metadata_key: 'count', value: 1, append_if_key_exists: true }], { count: [null, 1] }],
    ['resolves metadata values from the body', [{ metadata_key: 'count', value_expression: 'length(/items)' }], { count: 2 }],
    ['evaluates metadata predicates against the body', [{ metadata_key: 'count', value: 1, add_when: '/enabled == true' }], { count: 1 }],
    ['skips metadata writes on false predicates', [{ metadata_key: 'count', value: 1, add_when: '/enabled == false' }], {}],
    ['keeps metadata keys literal', [{ metadata_key: '${/enabled}', value: 1 }], { '${/enabled}': 1 }],
    ['allows safe literal prototype-named attributes', [{ metadata_key: '__proto__', value: { safe: true } }], { ['__proto__']: { safe: true } }],
  ] as [string, Event[], Event][])('add_entries %s', (_name, entries, attributes) => {
    const input = { enabled: true, items: [1, 2], count: 'body' };
    const result = run(input, 'add_entries', { entries });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(input);
    expect(JSON.parse(JSON.stringify(result.events[0]?.output))).toEqual(input);
    expect(result.events[0]?.outputMetadata).toEqual(Object.keys(attributes).length ? { attributes, tags: [] } : undefined);
    expect(({} as Record<string, unknown>).safe).toBeUndefined();
  });

  it.each([
    ['getMetadata("count") + 1', 3],
    ['getMetadata(" count ")', 2],
    ['getMetadata("nested/value")', 'hello'],
    ['getMetadata("missing")', null],
    ['getMetadata("")', null],
    ['getMetadata("   ")', null],
    ['length(getMetadata("nested/value"))', 5],
    ['getMetadata("tags")', ['attribute-tag']],
    ['hasTags("attribute-tag")', false],
  ] as [string, unknown][])('reads metadata expression %s', (expression, expected) => {
    const input = { count: 'body' };
    const result = run(input, 'add_entries', { entries: [
      { metadata_key: 'count', value: 2 }, { metadata_key: 'nested', value: { value: 'hello' } },
      { metadata_key: 'tags', value: ['attribute-tag'] }, { key: 'result', value_expression: expression },
    ] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ ...input, result: expected });
  });

  it.each([
    ['parse_json', { tags_on_failure: ['parse-failure'] }, { message: 'invalid' }, ['parse-failure']],
    ['parse_json', { tags_on_failure: ['parse-failure'] }, { message: 'null' }, ['parse-failure']],
    ['parse_json', { tags_on_failure: ['parse-failure'], delete_source: true }, { message: '[1,2]' }, ['parse-failure']],
    ['parse_json', { tags_on_failure: ['parse-failure'] }, { message: '123' }, ['parse-failure']],
    ['parse_json', { tags_on_failure: ['parse-failure'] }, {}, []],
    ['parse_json', { tags_on_failure: ['parse-failure'] }, { message: null }, []],
    ['parse_json', { tags_on_failure: ['parse-failure'] }, { message: 123 }, []],
    ['parse_json', { tags_on_failure: ['parse-failure'], pointer: '/value' }, {}, ['parse-failure']],
    ['parse_json', { tags_on_failure: ['parse-failure'], parse_when: 'false' }, { message: 'invalid' }, []],
    ['grok', { match: { message: ['%{NUMBER:value}'] }, tags_on_match_failure: ['grok-failure'] }, { message: 'hello' }, ['grok-failure']],
    ['grok', { match: { message: ['%{NUMBER:value}'] }, tags_on_match_failure: ['grok-failure'] }, {}, ['grok-failure']],
    ['grok', { match: { message: ['%{NUMBER:value}'] }, tags_on_match_failure: ['grok-failure'] }, { message: '' }, ['grok-failure']],
    ['grok', { match: { message: ['hello'] }, tags_on_match_failure: ['grok-failure'] }, { message: 'hello' }, ['grok-failure']],
    ['grok', { match: { message: ['%{NUMBER:value}'] }, tags_on_match_failure: ['grok-failure'], grok_when: 'false' }, { message: 'hello' }, []],
    ['obfuscate', { source: 'message', patterns: ['[0-9]+'], tags_on_match_failure: ['mask-failure'] }, { message: 'hello' }, ['mask-failure']],
    ['obfuscate', { source: 'message', tags_on_match_failure: ['mask-failure'] }, { message: '***' }, ['mask-failure']],
    ['obfuscate', { source: 'message', tags_on_match_failure: ['mask-failure'] }, {}, []],
    ['obfuscate', { source: 'message', patterns: ['[0-9]+'], tags_on_match_failure: ['mask-failure'], obfuscate_when: 'false' }, { message: 'hello' }, []],
  ] as [string, Event, Event, string[]][])('%s emits failure tags only in its upstream failure cases', (processor, config, input, tags) => {
    const result = run(input, processor, config);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(input);
    expect(result.events[0]?.outputMetadata).toEqual(tags.length ? { attributes: {}, tags } : undefined);
  });

  it.each([
    ['parse_json', { destination: 'parsed', tags_on_failure: ['failure'] }, { message: '[1,2]' }],
    ['parse_json', { tags_on_failure: ['failure'] }, { message: '{"a":1}' }],
    ['grok', { match: { message: ['%{WORD:value}'] }, tags_on_match_failure: ['failure'] }, { message: 'hello' }],
    ['obfuscate', { source: 'message', tags_on_match_failure: ['failure'] }, { message: 'secret' }],
  ] as [string, Event, Event][])('%s successful processing does not emit failure tags', (processor, config, input) => {
    const result = run(input, processor, config);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.outputMetadata).toBeUndefined();
  });

  it.each([
    ['hasTags("parse-failure")', true],
    ['hasTags("parse-failure", "mask-failure")', true],
    ['hasTags("parse-failure", "absent")', false],
    ['hasTags("absent")', false],
    ['hasTags("parse-failure", "parse-failure")', true],
  ] as [string, boolean][])('failure tags drive predicate %s', (condition, applies) => {
    const input = { message: 'invalid' };
    const yaml = dump({ test: { processor: [
      { parse_json: { tags_on_failure: ['parse-failure', 'parse-failure'] } },
      { obfuscate: { source: 'message', patterns: ['[0-9]+'], tags_on_match_failure: ['mask-failure', 'parse-failure'] } },
      { add_entries: { entries: [{ key: 'changed', value: true, add_when: condition }] } },
    ] } });
    const result = simulatePipeline(JSON.stringify(input), 'json', yaml);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(applies ? { ...input, changed: true } : input);
    expect(result.events[0]?.outputMetadata).toEqual({ attributes: {}, tags: ['parse-failure', 'mask-failure'] });
  });

  it('metadata remains available in list value expressions and element predicates', () => {
    const input = { message: 'invalid', items: [{ enabled: true, secret: 'hide' }, { enabled: false, secret: 'keep' }] };
    const yaml = dump({ test: { processor: [
      { parse_json: { tags_on_failure: ['parse-failure'] } },
      { add_entries: { entries: [
        { metadata_key: 'label', value: 'metadata' },
        { iterate_on: 'items', key: 'label', value_expression: 'getMetadata("label")', add_to_element_when: 'hasTags("parse-failure") and /enabled == true', evaluate_when_on_element: true },
      ] } },
      { delete_entries: { with_keys: ['secret'], iterate_on: 'items', delete_from_element_when: 'getMetadata("label") == "metadata" and /enabled == true' } },
    ] } });
    const result = simulatePipeline(JSON.stringify(input), 'json', yaml);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ message: 'invalid', items: [{ enabled: true, label: 'metadata' }, { enabled: false, secret: 'keep' }] });
    expect(result.events[0]?.outputMetadata).toEqual({ attributes: { label: 'metadata' }, tags: ['parse-failure'] });
  });

  it('dynamic keys can read metadata attributes', () => {
    const result = run({}, 'add_entries', { entries: [
      { metadata_key: 'field', value: 'fromMetadata' }, { key: '${getMetadata("field")}', value: 1 },
    ] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ fromMetadata: 1 });
    expect(result.events[0]?.outputMetadata).toEqual({ attributes: { field: 'fromMetadata' }, tags: [] });
  });

  it('metadata and tags remain isolated between events', () => {
    const yaml = dump({ test: { processor: [
      { parse_json: { tags_on_failure: ['failure'] } },
      { add_entries: { entries: [{ metadata_key: 'failed', value: true, add_when: 'hasTags("failure")' }] } },
    ] } });
    const input = [{ message: 'invalid' }, { message: '{"a":1}' }];
    const result = simulatePipeline(JSON.stringify(input), 'json', yaml);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.outputMetadata).toEqual({ attributes: { failed: true }, tags: ['failure'] });
    expect(result.events[1]?.outputMetadata).toBeUndefined();
    expect(result.events[1]?.output).toEqual({ message: '{"a":1}', a: 1 });
  });

  it.each([
    ['mutate', { add: { added: 1 } }],
    ['add_entries', { entries: [{ key: 'added', value: 1 }] }],
    ['delete_entries', { with_keys: ['text'] }],
    ['rename_keys', { entries: [{ from_key: 'text', to_key: 'renamed' }] }],
    ['copy_values', { entries: [{ from_key: 'text', to_key: 'copied' }] }],
    ['date', { match: [{ key: 'timestamp', patterns: ['epoch_milli'] }] }],
    ['grok', { match: { text: ['%{WORD:value}'] } }],
    ['flatten', { source: 'data', target: 'flat' }],
    ['truncate', { entries: [{ source_keys: ['text'], length: 2 }] }],
    ['obfuscate', { source: 'text' }],
    ['key_value', { source: 'kv' }],
    ['csv', { source: 'text', column_names: ['first', 'second'] }],
    ['parse_json', {}],
    ['split_string', { entries: [{ source: 'text', delimiter: ',' }] }],
    ['substitute_string', { entries: [{ source: 'text', from: 'a', to: 'b' }] }],
  ] as [string, Event][])('%s preserves metadata and tags for later expressions', (processor, config) => {
    const input = { bad: 'invalid', message: '{"a":1}', text: 'a,b', data: { Key: 'hello' }, kv: 'a=1', timestamp: '1700000000000' };
    const yaml = dump({ test: { processor: [
      { add_entries: { entries: [{ metadata_key: 'marker', value: 'kept' }] } },
      { parse_json: { source: 'bad', tags_on_failure: ['failure'] } },
      { [processor]: config },
      { add_entries: { entries: [{ key: 'verified', value: true, add_when: 'getMetadata("marker") == "kept" and hasTags("failure")' }] } },
    ] } });
    const result = simulatePipeline(JSON.stringify(input), 'json', yaml);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output.verified).toBe(true);
    expect(result.events[0]?.outputMetadata).toEqual({ attributes: { marker: 'kept' }, tags: ['failure'] });
  });

  it('metadata lookup does not use event JSON Pointer decoding or array indexing', () => {
    const result = run({}, 'add_entries', { entries: [
      { metadata_key: 'data', value: { 'a~1b': 1, 'a/b': 2, list: [3] } },
      { key: 'literal', value_expression: 'getMetadata("data/a~1b")' },
      { key: 'index', value_expression: 'getMetadata("data/list/0")' },
      { key: 'absent', value_expression: 'getMetadata("constructor")' },
    ] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ literal: 1, index: null, absent: null });
  });

  it.each(['hasTags()', 'hasTags("")', 'hasTags(1)', 'hasTags(/body)', 'getMetadata()', 'getMetadata(1)', 'getMetadata(/body)', 'getMetadata("a", "b")'])('rejects invalid metadata expression %s', expression => {
    const input = { body: 'key' };
    const result = run(input, 'add_entries', { entries: [{ key: 'result', value_expression: expression }] });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.events[0]?.output).toEqual(input);
  });

  it.each([
    ['2 + 3 * 4', {}, 14],
    ['(2 + 3) * 4', {}, 20],
    ['20 - 4 - 3', {}, 13],
    ['-(/a + 2) * -3', { a: 4 }, 18],
    ['/a / /b', { a: 7, b: 2 }, 3.5],
    ['10 % 3', {}, 1],
    ['-10 % 3', {}, -1],
    ['1.25 + 2.5', {}, 3.75],
    ['"hello" + " world"', {}, 'hello world'],
    ['/first + " " + /last', { first: 'Ada', last: 'Lovelace' }, 'Ada Lovelace'],
    ['length(/message)', { message: 'hello' }, 5],
    ['length("hello") + 1', {}, 6],
    ['length(/items)', { items: [1, 2] }, 2],
    ['length(/data)', { data: { a: 1, b: 2 } }, 2],
    ['length(/missing)', {}, null],
    ['length(/data) * (length(/items) + 1)', { data: { a: 1, b: 2 }, items: [1, 2] }, 6],
    ['length("/odd-key")', { 'odd-key': 'hello' }, 5],
    ['contains(/message, "error")', { message: 'an error happened' }, true],
    ['contains(/message, /needle)', { message: 'an error happened', needle: 'success' }, false],
    ['contains(/missing, "error")', {}, false],
    ['startsWith(/url, "https://")', { url: 'https://example.com' }, true],
    ['startsWith(/missing, "https://")', {}, false],
    ['join(/items)', { items: [1, 'two', true] }, '1,two,true'],
    ['join("|", /items)', { items: ['a', 'b'] }, 'a|b'],
    ['join(/items)', { items: [] }, ''],
    ['join("|", /data)', { data: { list: [1, 2], value: 'keep', nil: null, failing: [1, null] } }, { list: '1|2', value: 'keep', nil: null, failing: [1, null] }],
    ['length(join("|", /items))', { items: ['a', 'b'] }, 3],
  ] as [string, Event, unknown][])('evaluates processing value expression %s', (expression, input, expected) => {
    const result = run(input, 'add_entries', { entries: [{ key: 'result', value_expression: expression }] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ ...input, result: expected });
  });

  it.each([
    ['/count + 1 >= 4', { count: 3 }, true],
    ['/count * 2 > 10', { count: 3 }, false],
    ['contains(/message, "error") and startsWith(/url, "https://")', { message: 'error', url: 'https://example.com' }, true],
    ['length(/items) > 1', { items: [1, 2] }, true],
    ['length(join("|", /items)) == 3', { items: ['a', 'b'] }, true],
    ['true or false and false', {}, false],
    ['true or (false and false)', {}, true],
    ['/status in {200, 201, 202}', { status: 201 }, true],
    ['/status not in {200, 201}', { status: 500 }, true],
    ['/status in {200, 201}', { status: '200' }, false],
    ['/state in {"ready", "running"}', { state: 'ready' }, true],
    ['/enabled in {true, false}', { enabled: false }, true],
    ['/missing in {"ready"}', {}, false],
    ['/missing not in {"ready"}', {}, true],
    ['/message =~ "hello.*"', { message: 'hello world' }, true],
    ['/message =~ "hello"', { message: 'hello world' }, false],
    ['/message !~ "hello"', { message: 'hello world' }, true],
    ['/message =~ /pattern', { message: 'hello', pattern: 'h.*o' }, true],
    ['/message =~ "a|abc"', { message: 'abc' }, true],
    ['/missing =~ ".*"', {}, false],
    ['/missing !~ ".*"', {}, false],
    ['/message =~ "["', { message: 'hello' }, false],
    ['/message !~ "["', { message: 'hello' }, false],
    ['/value typeof string', { value: 'hello' }, true],
    ['/value typeof boolean', { value: false }, true],
    ['/value typeof map', { value: { a: 1 } }, true],
    ['/value typeof array', { value: [1, 2] }, true],
    ['/value typeof map', { value: [1, 2] }, false],
    ['/left == /right', { left: { a: 1, b: [2] }, right: { b: [2], a: 1 } }, true],
    ['/left != /right', { left: [1, 2], right: [2, 1] }, true],
  ] as [string, Event, boolean][])('evaluates processing predicate %s', (condition, input, applies) => {
    const result = run(input, 'add_entries', { entries: [{ key: 'changed', value: true, add_when: condition }] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(applies ? { ...input, changed: true } : input);
  });

  it.each([
    'length()', 'length(1)', 'contains("one")', 'contains(1, "one")',
    'startsWith("one", false)', 'join("items")', 'join("|", length(/items))',
    'join(/missing)', 'join(/withNull)', 'length(/number)',
    '/number + "string"', '-"string"', '/missing + 1', '1.5 % 1', '1 / 0',
    'true in {1, "one"}', 'true in {}', '/number typeof integer', 'endsWith("one", "e")',
    '2 +', 'length(/items', 'globalThis.alert("test")', '1 in /items', '{1, 2}',
  ])('reports invalid or unsupported processing expression %s', expression => {
    const input = { items: [1, 2], withNull: [1, null], number: 3 };
    const result = run(input, 'add_entries', { entries: [{ key: 'result', value_expression: expression }] });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.events[0]?.output).toEqual(input);
  });

  it('evaluates functions in dynamic keys', () => {
    const input = { items: [1, 2] };
    const result = run(input, 'add_entries', { entries: [{ key: 'count-${length(/items)}', value: true }] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ ...input, 'count-2': true });
  });

  it('shares expression behavior across a chain and list-element predicates', () => {
    const input = { message: 'error', items: [{ secret: 'hide' }, { secret: '' }] };
    const yaml = dump({ test: { processor: [
      { add_entries: { entries: [{ key: 'score', value_expression: 'length(/items) * 2' }] } },
      { copy_values: { entries: [{ from_key: 'message', to_key: 'copy', copy_when: '/score > 2 and contains(/message, "error")' }] } },
      { delete_entries: { with_keys: ['secret'], iterate_on: 'items', delete_from_element_when: 'length(/secret) > 0' } },
    ] } });
    const result = simulatePipeline(JSON.stringify(input), 'json', yaml);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual({ message: 'error', copy: 'error', score: 4, items: [{}, { secret: '' }] });
  });

  it.each(cases)('$name', ({ processor, config, input, output }) => {
    const before = structuredClone(input);
    const result = run(input, processor, config);
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(output);
    expect(input).toEqual(before);
  });

  it.each([
    ['add_entries', { entries: [{ key: 'changed', value: true, add_when: '/enabled == true' }] }],
    ['copy_values', { entries: [{ from_key: 'message', to_key: 'changed', copy_when: '/enabled == true' }] }],
    ['rename_keys', { entries: [{ from_key: 'message', to_key: 'changed', rename_when: '/enabled == true' }] }],
    ['delete_entries', { with_keys: ['message'], delete_when: '/enabled == true' }],
    ['parse_json', { parse_when: '/enabled == true' }],
    ['csv', { csv_when: '/enabled == true' }],
    ['flatten', { source: '', target: 'flat', flatten_when: '/enabled == true' }],
    ['split_string', { entries: [{ source: 'message', delimiter: ',', split_when: '/enabled == true' }] }],
    ['substitute_string', { entries: [{ source: 'message', from: 'a', to: 'b', substitute_when: '/enabled == true' }] }],
    ['truncate', { entries: [{ source_keys: ['message'], length: 1, truncate_when: '/enabled == true' }] }],
    ['date', { date_when: '/enabled == true', from_time_received: true }],
    ['grok', { grok_when: '/enabled == true', match: { message: ['%{WORD:name}'] } }],
    ['obfuscate', { obfuscate_when: '/enabled == true', source: 'message' }],
    ['key_value', { key_value_when: '/enabled == true' }],
  ] as [string, Event][])('%s respects its upstream conditional option', (processor, config) => {
    const input = { enabled: false, message: '{"a":"a,b"}' };
    expect(run(input, processor, config).events[0]?.output).toEqual(input);
  });

  it.each([
    ['/a == 1 || /b == 2 && /c == 3', { a: 1, b: 0, c: 0 }, true],
    ['(/a == 1 || /b == 2) && /c == 3', { a: 1, b: 0, c: 0 }, false],
    ['!(/enabled == true)', { enabled: false }, true],
    ['/message == "rock and roll"', { message: 'rock and roll' }, true],
    ['true', {}, true],
    ['false', {}, false],
    ['/missing == null', {}, true],
    ['/missing != null', {}, false],
  ] as [string, Event, boolean][])('evaluates the basic upstream expression %s', (condition, input, applies) => {
    const result = run(input, 'add_entries', { entries: [{ key: 'changed', value: true, add_when: condition }] });
    expect(result.errors).toEqual([]);
    expect(result.events[0]?.output).toEqual(applies ? { ...input, changed: true } : input);
  });

  it('rejects multiple pipelines instead of chaining unrelated processors', () => {
    const result = simulatePipeline('{}', 'json', dump({ a: { processor: [] }, b: { processor: [] } }));
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('one pipeline at a time');
  });

  it.each(['test: null', 'test:\n  processor: invalid', 'test:\n  processor:\n    - null'])('reports malformed processor structure: %s', yaml => {
    expect(() => simulatePipeline('{}', 'json', yaml)).not.toThrow();
    expect(simulatePipeline('{}', 'json', yaml).success).toBe(false);
  });

  it.each([
    ['split_string', { entries: [{ source: 'message', delimiter: ',', delimiter_regex: ',' }] }],
    ['split_string', { entries: [{ source: 'message' }] }],
    ['substitute_string', { entries: [{ source: 'message', from: '[', to: '' }] }],
    ['truncate', { entries: [{ length: -1 }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, overwrite_if_key_exists: true, append_if_key_exists: true }] }],
    ['flatten', { source: '', target: '', flatten_separator: 'too long' }],
    ['obfuscate', { source: 'message', action: { hash: {} } }],
    ['csv', { multi_line: true }],
    ['csv', { multiline: true }],
  ] as [string, Event][])('rejects invalid or unrepresentable %s configuration before processing', (processor, config) => {
    const result = run({}, processor, config);
    expect(result.success).toBe(false);
    expect(result.errors[0]?.eventIndex).toBe(-1);
    expect(result.events).toEqual([]);
  });

  it('warns when upstream options are not simulated', () => {
    const result = run({ a: 1 }, 'key_value', { recursive: true });
    expect(result.warnings).toContain('key_value: options not simulated: recursive');
  });

  it.each([
    ['add_entries', { entries: [{ key: 'a', value: 1, flatten_key: false }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, disable_root_keys: false }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, add_to_element_when: 'true' }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, iterate_on: 'items', evaluate_when_on_element: true }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, iterate_on: 123 }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, flatten_key: 'true' }] }],
    ['add_entries', { entries: [{ key: 'a', value: 1, format: 'extra' }] }],
    ['add_entries', { entries: [{ key: 'a', value: null }] }],
    ['add_entries', { entries: [{ metadata_key: 'a', key: 'a', value: 1 }] }],
    ['add_entries', { entries: [{ metadata_key: 'a', iterate_on: 'items', value: 1 }] }],
    ['add_entries', { entries: [{ metadata_key: 123, value: 1 }] }],
    ['parse_json', { tags_on_failure: 'bad' }],
    ['grok', { match: { message: ['%{WORD:value}'] }, tags_on_match_failure: [123] }],
    ['obfuscate', { source: 'message', tags_on_match_failure: 'bad' }],
    ['copy_values', { from_list: 'items', entries: [{ from_key: 'a', to_key: 'b' }] }],
    ['rename_keys', { transform_key: 'lowercase', entries: [{ from_key: 'a', to_key: 'b' }] }],
    ['rename_keys', { entries: [{ from_key: 'a', from_key_regex: 'a', to_key: 'b' }] }],
    ['rename_keys', { entries: [{ from_key_regex: '[', to_key: 'b' }] }],
    ['delete_entries', { with_keys: ['a'], with_keys_regex: ['a'] }],
    ['delete_entries', { with_keys: ['a'], delete_from_element_when: '/enabled == true' }],
    ['delete_entries', { entries: [{ with_keys: ['a'], exclude_from_delete: ['b'] }] }],
    ['delete_entries', { with_keys_regex: ['['] }],
    ['key_value', { destination_conflict_strategy: 'skip', overwrite_if_destination_exists: true }],
    ['key_value', { destination_conflict_strategy: 'unknown' }],
  ] as [string, Event][])('rejects incompatible %s processing options before execution', (processor, config) => {
    const result = run({}, processor, config);
    expect(result.success).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.errors[0]?.eventIndex).toBe(-1);
  });

  it('reports unsupported conditional functions instead of silently skipping the processor', () => {
    const result = run({}, 'add_entries', { entries: [{ key: 'a', value: 1, add_when: 'unsupportedFunction("tag")' }] });
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('Unsupported condition');
  });

  it.each([
    ['grok', { match: { message: ['%{UNKNOWN:value}'] } }],
    ['obfuscate', { source: 'message', patterns: ['['], action: { mask: {} } }],
  ] as [string, Event][])('reports unavailable or invalid %s patterns and preserves the event', (processor, config) => {
    const input = { message: 'hello' };
    const result = run(input, processor, config);
    expect(result.success).toBe(false);
    expect(result.events[0]?.output).toEqual(input);
    expect(result.errors).toHaveLength(1);
  });
});
