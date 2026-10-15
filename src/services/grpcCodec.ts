// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import protobuf from 'protobufjs';
import schema from '../protobuf/opensearch-1.2.0.proto?raw';
import type { GrpcMethod } from '../types/cell';

const root = new protobuf.Root();
root.addJSON(protobuf.common.get('google/protobuf/struct.proto')!.nested!);
protobuf.parse(schema, root, { keepCase: true });
root.resolveAll();

function messageType(method: GrpcMethod, suffix: 'Request' | 'Response'): protobuf.Type {
  if (method !== 'Search' && method !== 'Bulk') throw new Error('Unsupported gRPC method.');
  return root.lookupType(`org.opensearch.protobufs.${method}${suffix}`);
}

// protobufjs fromObject coerces invalid scalars and drops unknown fields. Reject
// those before conversion so a mistyped filter cannot become an unfiltered query.
function validateMessage(type: protobuf.Type, value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`);
  const object = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(object)) {
    const field = Object.prototype.hasOwnProperty.call(type.fields, key) ? type.fields[key] : undefined;
    if (!field) throw new Error(`${path}.${key}: unknown Protobuf field (use snake_case names)`);
    if (entry === null) throw new Error(`${path}.${key}: omit unset fields instead of using null`);
    const values = field.map ? Object.values(requireObject(entry, `${path}.${key}`)) : field.repeated ? requireArray(entry, `${path}.${key}`) : [entry];
    for (const item of values) {
      const name = `${path}.${key}`;
      if (field.resolvedType instanceof protobuf.Type) {
        validateMessage(field.resolvedType, item, name);
      } else if (field.resolvedType instanceof protobuf.Enum) {
        const enumeration = field.resolvedType.values;
        if (!(typeof item === 'string' && Object.prototype.hasOwnProperty.call(enumeration, item)) &&
            !(typeof item === 'number' && Object.values(enumeration).includes(item))) throw new Error(`${name}: invalid enum value`);
      } else if (field.type === 'bytes') {
        if (typeof item !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item)) throw new Error(`${name}: expected Base64-encoded bytes`);
      } else if (field.type === 'string' || field.type === 'bool') {
        if (typeof item !== (field.type === 'bool' ? 'boolean' : 'string')) throw new Error(`${name}: expected ${field.type}`);
      } else if (field.type.includes('64')) {
        const unsigned = field.type.startsWith('u') || field.type === 'fixed64';
        if (!(typeof item === 'string' && /^-?\d+$/.test(item)) && !(typeof item === 'number' && Number.isSafeInteger(item))) throw new Error(`${name}: expected a safe integer or decimal integer string`);
        const integer = BigInt(item as string | number);
        if (integer < (unsigned ? 0n : -(1n << 63n)) || integer > (unsigned ? (1n << 64n) - 1n : (1n << 63n) - 1n)) throw new Error(`${name}: integer out of range`);
      } else {
        if (typeof item !== 'number' || !Number.isFinite(item)) throw new Error(`${name}: expected a finite number`);
        if (field.type.includes('32') && field.type !== 'float') {
          const unsigned = field.type.startsWith('u') || field.type === 'fixed32';
          if (!Number.isInteger(item) || item < (unsigned ? 0 : -2147483648) || item > (unsigned ? 4294967295 : 2147483647)) throw new Error(`${name}: integer out of range`);
        }
      }
    }
  }
  for (const oneof of type.oneofsArray) {
    if (oneof.oneof.filter(key => object[key] !== undefined).length > 1) throw new Error(`${path}: only one of ${oneof.oneof.join(', ')} may be set`);
  }
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected a map object`);
  return value as Record<string, unknown>;
}
function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: expected an array`);
  return value;
}

export function encodeGrpcRequest(method: GrpcMethod, body: string): string {
  const object: unknown = JSON.parse(body);
  const type = messageType(method, 'Request');
  validateMessage(type, object, `${method}Request`);
  const message = type.fromObject(object as Record<string, unknown>);
  const error = type.verify(message);
  if (error) throw new Error(error);
  const bytes = type.encode(message).finish();
  if (bytes.length > 10 * 1024 * 1024) throw new Error('gRPC request exceeds the 10 MiB limit.');
  return protobuf.util.base64.encode(bytes, 0, bytes.length);
}

export function decodeGrpcResponse(method: GrpcMethod, payload: string): unknown {
  const bytes = new Uint8Array(protobuf.util.base64.length(payload));
  protobuf.util.base64.decode(payload, bytes, 0);
  const type = messageType(method, 'Response');
  return type.toObject(type.decode(bytes), { longs: String, enums: String, bytes: String });
}
