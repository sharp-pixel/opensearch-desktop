// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { jsonCompletionContext } from './jsonCompletionContext';

const fieldQueries = new Set(['match', 'match_phrase', 'match_phrase_prefix', 'term', 'terms', 'range', 'prefix', 'wildcard', 'regexp', 'fuzzy', 'span_term', 'geo_bounding_box', 'geo_distance', 'geo_polygon', 'geo_shape', 'knn']);
const fieldParameters = new Set(['exists', 'terms', 'date_histogram', 'histogram', 'range', 'date_range', 'avg', 'sum', 'min', 'max', 'cardinality', 'value_count', 'stats', 'extended_stats', 'percentiles', 'percentile_ranks', 'missing', 'significant_terms', 'significant_text', 'collapse']);

/** Only suggest mapped fields where DSL expects a field, never literal query text. */
export function dslFieldContext(text: string, offset: number): 'field' | 'nested' | null {
  const context = jsonCompletionContext(text, offset);
  const path = context.path;
  const last = path[path.length - 1];
  if (context.isProperty) {
    const isAggregationType = ['aggs', 'aggregations'].includes(path[path.length - 3] || '');
    if (last && fieldQueries.has(last) && !isAggregationType) return 'field';
    if (path.length === 1 && last === 'sort') return 'field';
    if (path.join('.') === 'highlight.fields') return 'field';
  }
  if (!context.isValue) return null;
  if (context.key === 'path' && last === 'nested') return 'nested';
  if (context.key === 'field' && last && fieldParameters.has(last)) return 'field';
  if (path.length === 0 && ['_source', 'fields', 'stored_fields', 'docvalue_fields', 'sort'].includes(context.key || '')) return 'field';
  if (path.length === 1 && ['_source', 'fields', 'stored_fields', 'docvalue_fields', 'sort'].includes(last || '')) return 'field';
  if (path[0] === '_source' && (['includes', 'excludes'].includes(last || '') || ['includes', 'excludes'].includes(context.key || ''))) return 'field';
  if (last === 'fields' && ['multi_match', 'query_string', 'simple_query_string'].includes(path[path.length - 2] || '')) return 'field';
  return null;
}
