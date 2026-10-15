// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * PPL (Piped Processing Language) types for autocomplete and language support
 * Requirements: PPL 4.1, 4.3, 4.4
 */

/**
 * PPL suggestion types for autocomplete
 */
export type PPLSuggestionType = 
  | 'command' 
  | 'function' 
  | 'operator' 
  | 'index' 
  | 'field'
  | 'keyword';

/**
 * PPL autocomplete suggestion
 */
export interface PPLSuggestion {
  label: string;
  type: PPLSuggestionType;
  description: string;
  insertText: string;
  detail?: string;
}

/**
 * PPL context positions for autocomplete
 */
export type PPLContextPosition = 
  | 'start' 
  | 'after_source' 
  | 'after_explain'
  | 'after_pipe' 
  | 'in_command' 
  | 'in_function'
  | 'in_where'
  | 'unknown';

/**
 * PPL context for autocomplete
 */
export interface PPLContext {
  position: PPLContextPosition;
  currentCommand?: string;
  sourceIndex?: string;
  inFunction?: string;
}

/**
 * PPL command definition
 */
export interface PPLCommand {
  name: string;
  description: string;
  syntax: string;
}

/**
 * PPL function definition
 */
export interface PPLFunction {
  name: string;
  description: string;
  syntax: string;
}

/**
 * PPL operator definition
 */
export interface PPLOperator {
  name: string;
  description: string;
}

/**
 * PPL Commands - pipe operations
 */
export const PPL_COMMANDS: PPLCommand[] = [
  { name: 'source', description: 'Specify the index to query', syntax: 'source=<index>' },
  { name: 'explain', description: 'Show the execution plan for a query', syntax: 'explain source=<index> | ...' },
  { name: 'where', description: 'Filter results by condition', syntax: '| where <condition>' },
  { name: 'fields', description: 'Select specific fields to return', syntax: '| fields <field1>, <field2>, ...' },
  { name: 'stats', description: 'Aggregate data with functions', syntax: '| stats <agg_function> by <field>' },
  { name: 'sort', description: 'Sort results by field', syntax: '| sort [+|-] <field>' },
  { name: 'head', description: 'Return first N results', syntax: '| head [N]' },
  { name: 'dedup', description: 'Remove duplicate values', syntax: '| dedup <field> [keepempty=true]' },
  { name: 'eval', description: 'Create calculated fields', syntax: '| eval <field>=<expression>' },
  { name: 'rename', description: 'Rename fields', syntax: '| rename <old_name> as <new_name>' },
  { name: 'rare', description: 'Find rare values', syntax: '| rare <field> [by <group_field>]' },
  { name: 'top', description: 'Find top N values', syntax: '| top [N] <field> [by <group_field>]' },
  { name: 'parse', description: 'Parse field with regex pattern', syntax: '| parse <field> <pattern>' },
  { name: 'grok', description: 'Parse field with grok pattern', syntax: '| grok <field> <pattern>' },
  { name: 'patterns', description: 'Extract log patterns', syntax: '| patterns <field>' },
  { name: 'lookup', description: 'Lookup values from another index', syntax: '| lookup <index> <field>' },
  { name: 'join', description: 'Join with another index', syntax: '| join ON <condition> <index>' },
  { name: 'eventstats', description: 'Enrich events with statistics', syntax: '| eventstats <agg_function> by <field>' },
  { name: 'trendline', description: 'Calculate moving averages', syntax: '| trendline sma(<n>, <field>)' },
  { name: 'flatten', description: 'Flatten nested fields', syntax: '| flatten <field>' },
  { name: 'expand', description: 'Expand array field into rows', syntax: '| expand <field>' },
  { name: 'fillnull', description: 'Fill null values', syntax: '| fillnull value=<value> <field>' },
  { name: 'fieldsummary', description: 'Calculate field statistics', syntax: '| fieldsummary includefields=<field>' },
];

/**
 * PPL Aggregation Functions
 */
export const PPL_FUNCTIONS: PPLFunction[] = [
  { name: 'count', description: 'Count of values', syntax: 'count()' },
  { name: 'sum', description: 'Sum of numeric values', syntax: 'sum(<field>)' },
  { name: 'avg', description: 'Average of numeric values', syntax: 'avg(<field>)' },
  { name: 'min', description: 'Minimum value', syntax: 'min(<field>)' },
  { name: 'max', description: 'Maximum value', syntax: 'max(<field>)' },
  { name: 'stddev', description: 'Standard deviation', syntax: 'stddev(<field>)' },
  { name: 'stddev_pop', description: 'Population standard deviation', syntax: 'stddev_pop(<field>)' },
  { name: 'stddev_samp', description: 'Sample standard deviation', syntax: 'stddev_samp(<field>)' },
  { name: 'var', description: 'Variance', syntax: 'var(<field>)' },
  { name: 'var_pop', description: 'Population variance', syntax: 'var_pop(<field>)' },
  { name: 'var_samp', description: 'Sample variance', syntax: 'var_samp(<field>)' },
  { name: 'percentile', description: 'Percentile value', syntax: 'percentile(<field>, <percent>)' },
  { name: 'percentile_approx', description: 'Approximate percentile', syntax: 'percentile_approx(<field>, <percent>)' },
  { name: 'first', description: 'First value in group', syntax: 'first(<field>)' },
  { name: 'last', description: 'Last value in group', syntax: 'last(<field>)' },
  { name: 'distinct_count', description: 'Count of distinct values', syntax: 'distinct_count(<field>)' },
  { name: 'dc', description: 'Alias for distinct_count', syntax: 'dc(<field>)' },
  // String functions
  { name: 'concat', description: 'Concatenate strings', syntax: 'concat(<str1>, <str2>, ...)' },
  { name: 'substr', description: 'Extract substring', syntax: 'substr(<field>, <start>, <length>)' },
  { name: 'substring', description: 'Extract substring', syntax: 'substring(<field>, <start>, <length>)' },
  { name: 'trim', description: 'Remove whitespace', syntax: 'trim(<field>)' },
  { name: 'ltrim', description: 'Remove leading whitespace', syntax: 'ltrim(<field>)' },
  { name: 'rtrim', description: 'Remove trailing whitespace', syntax: 'rtrim(<field>)' },
  { name: 'lower', description: 'Convert to lowercase', syntax: 'lower(<field>)' },
  { name: 'upper', description: 'Convert to uppercase', syntax: 'upper(<field>)' },
  { name: 'length', description: 'String length', syntax: 'length(<field>)' },
  { name: 'replace', description: 'Replace substring', syntax: 'replace(<field>, <search>, <replace>)' },
  { name: 'like', description: 'Pattern matching', syntax: 'like(<field>, <pattern>)' },
  // Date functions
  { name: 'now', description: 'Current timestamp', syntax: 'now()' },
  { name: 'curdate', description: 'Current date', syntax: 'curdate()' },
  { name: 'date', description: 'Extract date part', syntax: 'date(<timestamp>)' },
  { name: 'time', description: 'Extract time part', syntax: 'time(<timestamp>)' },
  { name: 'year', description: 'Extract year', syntax: 'year(<date>)' },
  { name: 'month', description: 'Extract month', syntax: 'month(<date>)' },
  { name: 'day', description: 'Extract day', syntax: 'day(<date>)' },
  { name: 'dayofweek', description: 'Day of week (1-7)', syntax: 'dayofweek(<date>)' },
  { name: 'hour', description: 'Extract hour', syntax: 'hour(<timestamp>)' },
  { name: 'minute', description: 'Extract minute', syntax: 'minute(<timestamp>)' },
  { name: 'second', description: 'Extract second', syntax: 'second(<timestamp>)' },
  { name: 'date_format', description: 'Format date', syntax: 'date_format(<date>, <format>)' },
  { name: 'date_add', description: 'Add to date', syntax: 'date_add(<date>, <interval>)' },
  { name: 'date_sub', description: 'Subtract from date', syntax: 'date_sub(<date>, <interval>)' },
  { name: 'datediff', description: 'Difference between dates', syntax: 'datediff(<date1>, <date2>)' },
  { name: 'timestampdiff', description: 'Difference in units', syntax: 'timestampdiff(<unit>, <ts1>, <ts2>)' },
  // Math functions
  { name: 'abs', description: 'Absolute value', syntax: 'abs(<number>)' },
  { name: 'ceil', description: 'Round up', syntax: 'ceil(<number>)' },
  { name: 'ceiling', description: 'Round up', syntax: 'ceiling(<number>)' },
  { name: 'floor', description: 'Round down', syntax: 'floor(<number>)' },
  { name: 'round', description: 'Round to precision', syntax: 'round(<number>, [precision])' },
  { name: 'sqrt', description: 'Square root', syntax: 'sqrt(<number>)' },
  { name: 'pow', description: 'Power', syntax: 'pow(<base>, <exponent>)' },
  { name: 'power', description: 'Power', syntax: 'power(<base>, <exponent>)' },
  { name: 'log', description: 'Natural logarithm', syntax: 'log(<number>)' },
  { name: 'log10', description: 'Base-10 logarithm', syntax: 'log10(<number>)' },
  { name: 'log2', description: 'Base-2 logarithm', syntax: 'log2(<number>)' },
  { name: 'exp', description: 'Exponential', syntax: 'exp(<number>)' },
  { name: 'mod', description: 'Modulo', syntax: 'mod(<dividend>, <divisor>)' },
  // Conditional functions
  { name: 'if', description: 'Conditional expression', syntax: 'if(<condition>, <true_value>, <false_value>)' },
  { name: 'ifnull', description: 'Return value if not null', syntax: 'ifnull(<field>, <default>)' },
  { name: 'nullif', description: 'Return null if equal', syntax: 'nullif(<value1>, <value2>)' },
  { name: 'isnull', description: 'Check if null', syntax: 'isnull(<field>)' },
  { name: 'isnotnull', description: 'Check if not null', syntax: 'isnotnull(<field>)' },
  { name: 'coalesce', description: 'First non-null value', syntax: 'coalesce(<value1>, <value2>, ...)' },
  { name: 'case', description: 'Case expression', syntax: 'case(<field>, <value1>, <result1>, ...)' },
  // Type conversion
  { name: 'cast', description: 'Convert type', syntax: 'cast(<field> as <type>)' },
  { name: 'typeof', description: 'Get type name', syntax: 'typeof(<field>)' },
];

/**
 * PPL Operators
 */
export const PPL_OPERATORS: PPLOperator[] = [
  { name: '=', description: 'Equal to' },
  { name: '!=', description: 'Not equal to' },
  { name: '<>', description: 'Not equal to (alternative)' },
  { name: '<', description: 'Less than' },
  { name: '>', description: 'Greater than' },
  { name: '<=', description: 'Less than or equal' },
  { name: '>=', description: 'Greater than or equal' },
  { name: 'AND', description: 'Logical AND' },
  { name: 'OR', description: 'Logical OR' },
  { name: 'NOT', description: 'Logical NOT' },
  { name: 'LIKE', description: 'Pattern matching with wildcards' },
  { name: 'REGEXP', description: 'Regular expression matching' },
  { name: 'IN', description: 'Value in list' },
  { name: 'BETWEEN', description: 'Value in range (inclusive)' },
  { name: 'IS NULL', description: 'Check for null value' },
  { name: 'IS NOT NULL', description: 'Check for non-null value' },
];

/**
 * PPL Keywords (non-command keywords)
 */
export const PPL_KEYWORDS = [
  'as',
  'by',
  'asc',
  'desc',
  'true',
  'false',
  'null',
  'keepempty',
  'consecutive',
  'left',
  'right',
  'inner',
  'outer',
  'interval',
];
