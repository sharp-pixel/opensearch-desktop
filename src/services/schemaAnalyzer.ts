// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Schema Analyzer service for D3 chart visualizations
 * Analyzes PPL column types to determine compatible chart types and recommendations
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import type { PPLColumn } from '../types/cell';
import type { ConsolidatedRow } from '../types/investigation';
import type {
  ChartType,
  ChartConfig,
  ColumnAnalysis,
  ColumnCategory,
  SchemaAnalysis,
  PieChartConfig,
  BarChartConfig,
  HistogramConfig,
  GeoMapConfig,
} from '../types/chart';
import {
  DEFAULT_PIE_CONFIG,
  DEFAULT_BAR_CONFIG,
  DEFAULT_HISTOGRAM_CONFIG,
  DEFAULT_MAP_CONFIG,
} from '../types/chart';

/**
 * Temporal type patterns for column classification
 * Requirements: 3.2
 */
const TEMPORAL_TYPES = new Set([
  'timestamp',
  'date',
  'datetime',
  'time',
  'timestamp_ntz',
  'timestamp_ltz',
]);

/**
 * Geographic type patterns
 * Requirements: 3.3
 */
const GEO_TYPES = new Set(['geo_point', 'geo_shape']);

/**
 * Latitude column name patterns
 */
const LAT_PATTERNS = [/^lat$/i, /^latitude$/i, /lat$/i, /_lat$/i];

/**
 * Longitude column name patterns
 */
const LON_PATTERNS = [/^lon$/i, /^lng$/i, /^longitude$/i, /lon$/i, /lng$/i, /_lon$/i, /_lng$/i];

/**
 * Numeric types for measure classification
 * Requirements: 3.5
 */
const NUMERIC_TYPES = new Set([
  'integer',
  'int',
  'long',
  'short',
  'byte',
  'float',
  'double',
  'half_float',
  'scaled_float',
  'unsigned_long',
  'number',
  'bigint',
  'decimal',
  'numeric',
  'real',
]);

/**
 * String/categorical types for dimension classification
 * Requirements: 3.4
 */
const STRING_TYPES = new Set([
  'string',
  'keyword',
  'text',
  'varchar',
  'char',
  'ip',           // IP addresses are categorical
  'binary',
  'constant_keyword',
  'wildcard',
]);

/**
 * Cardinality threshold ratio for treating numeric columns as dimensions
 * If unique values / total rows < threshold, treat as dimension
 */
const CARDINALITY_THRESHOLD = 0.1;

/**
 * Maximum cardinality for a column to be considered a dimension
 */
const MAX_DIMENSION_CARDINALITY = 50;

/**
 * Check if a column type is temporal
 * Requirements: 3.2
 */
export function isTemporalType(type: string): boolean {
  return TEMPORAL_TYPES.has(type.toLowerCase());
}

/**
 * Check if a column type is geographic
 * Requirements: 3.3
 */
export function isGeoType(type: string): boolean {
  return GEO_TYPES.has(type.toLowerCase());
}

/**
 * Check if a column name matches latitude patterns
 */
export function isLatitudeColumn(name: string): boolean {
  return LAT_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if a column name matches longitude patterns
 */
export function isLongitudeColumn(name: string): boolean {
  return LON_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if a column type is numeric
 * Requirements: 3.5
 */
export function isNumericType(type: string): boolean {
  const lowerType = type.toLowerCase();
  // Direct match
  if (NUMERIC_TYPES.has(lowerType)) return true;
  // Check if type contains numeric indicators (e.g., "unsigned_long", "scaled_float")
  if (lowerType.includes('int') || lowerType.includes('float') || 
      lowerType.includes('double') || lowerType.includes('long') ||
      lowerType.includes('decimal') || lowerType.includes('numeric')) {
    return true;
  }
  return false;
}

/**
 * Check if a column type is string/categorical
 * Requirements: 3.4
 */
export function isStringType(type: string): boolean {
  const lowerType = type.toLowerCase();
  // Direct match
  if (STRING_TYPES.has(lowerType)) return true;
  // Check if type contains string indicators
  if (lowerType.includes('string') || lowerType.includes('text') || 
      lowerType.includes('char') || lowerType.includes('keyword')) {
    return true;
  }
  return false;
}

/**
 * Infer column category from actual data values
 * Used as fallback when type string is unknown
 */
function inferCategoryFromData(rows: ConsolidatedRow[], columnIndex: number): ColumnCategory {
  if (rows.length === 0) return 'unknown';
  
  // Sample some values to determine type
  let numericCount = 0;
  let stringCount = 0;
  let dateCount = 0;
  let sampleCount = 0;
  
  for (const row of rows.slice(0, 20)) {
    const value = row.data[columnIndex];
    if (value === null || value === undefined) continue;
    
    sampleCount++;
    
    if (typeof value === 'number') {
      numericCount++;
    } else if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
        dateCount++;
      } else {
        stringCount++;
      }
    } else if (value instanceof Date) {
      dateCount++;
    }
  }
  
  if (sampleCount === 0) return 'unknown';
  
  // Determine category based on majority
  if (dateCount > sampleCount * 0.5) return 'temporal';
  if (numericCount > sampleCount * 0.5) return 'measure';
  if (stringCount > sampleCount * 0.5) return 'dimension';
  
  return 'unknown';
}

/**
 * Calculate cardinality (unique value count) for a column
 */
function calculateCardinality(rows: ConsolidatedRow[], columnIndex: number): number {
  const uniqueValues = new Set<unknown>();
  for (const row of rows) {
    if (row.data[columnIndex] !== null && row.data[columnIndex] !== undefined) {
      uniqueValues.add(row.data[columnIndex]);
    }
  }
  return uniqueValues.size;
}

/**
 * Check if a column has null values
 */
function hasNullValues(rows: ConsolidatedRow[], columnIndex: number): boolean {
  return rows.some(row => row.data[columnIndex] === null || row.data[columnIndex] === undefined);
}

/**
 * Get sample values from a column
 */
function getSampleValues(rows: ConsolidatedRow[], columnIndex: number, maxSamples = 5): unknown[] {
  const samples: unknown[] = [];
  for (const row of rows) {
    if (samples.length >= maxSamples) break;
    const value = row.data[columnIndex];
    if (value !== null && value !== undefined && !samples.includes(value)) {
      samples.push(value);
    }
  }
  return samples;
}

/**
 * Classify a column into a category
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */
export function classifyColumn(
  column: PPLColumn,
  rows: ConsolidatedRow[],
  columnIndex: number
): ColumnCategory {
  const type = column.type.toLowerCase();
  
  // Check temporal first
  if (isTemporalType(type)) {
    return 'temporal';
  }
  
  // Check geographic
  if (isGeoType(type)) {
    return 'geo';
  }
  
  // A coordinate-like name alone does not make a categorical field geographic.
  if (isNumericType(type) && (isLatitudeColumn(column.name) || isLongitudeColumn(column.name))) {
    return 'geo';
  }
  
  // Check numeric types
  if (isNumericType(type)) {
    // Check cardinality - low cardinality numerics can be dimensions
    if (rows.length > 0) {
      const cardinality = calculateCardinality(rows, columnIndex);
      const cardinalityRatio = cardinality / rows.length;
      
      if (cardinality <= MAX_DIMENSION_CARDINALITY && cardinalityRatio < CARDINALITY_THRESHOLD) {
        return 'dimension';
      }
    }
    return 'measure';
  }
  
  // Check string types
  if (isStringType(type)) {
    return 'dimension';
  }
  
  // Boolean can be a dimension
  if (type === 'boolean' || type === 'bool') {
    return 'dimension';
  }
  
  // Fallback: infer from actual data values
  const inferredCategory = inferCategoryFromData(rows, columnIndex);
  if (inferredCategory !== 'unknown') {
    return inferredCategory;
  }
  
  return 'unknown';
}

/**
 * Analyze a single column
 */
function analyzeColumn(
  column: PPLColumn,
  rows: ConsolidatedRow[],
  columnIndex: number
): ColumnAnalysis {
  const category = classifyColumn(column, rows, columnIndex);
  
  return {
    name: column.name,
    type: column.type,
    category,
    cardinality: rows.length > 0 ? calculateCardinality(rows, columnIndex) : undefined,
    hasNulls: rows.length > 0 ? hasNullValues(rows, columnIndex) : false,
    sampleValues: rows.length > 0 ? getSampleValues(rows, columnIndex) : undefined,
  };
}

/**
 * Find latitude/longitude column pairs
 * Requirements: 3.3
 */
function findLatLonPairs(columns: ColumnAnalysis[]): string[] {
  const geoColumns: string[] = [];
  
  const latColumns = columns.filter(c => c.category === 'geo' && isLatitudeColumn(c.name));
  const lonColumns = columns.filter(c => c.category === 'geo' && isLongitudeColumn(c.name));
  
  // If we have both lat and lon columns, consider them as geo
  if (latColumns.length > 0 && lonColumns.length > 0) {
    geoColumns.push(...latColumns.map(c => c.name));
    geoColumns.push(...lonColumns.map(c => c.name));
  }
  
  return geoColumns;
}

/**
 * Analyze schema and determine compatible chart types
 * Requirements: 3.1, 3.6
 */
export function analyzeSchema(
  schema: PPLColumn[],
  rows: ConsolidatedRow[]
): SchemaAnalysis {
  // Analyze each column
  const columns: ColumnAnalysis[] = schema.map((col, index) => 
    analyzeColumn(col, rows, index)
  );
  
  // Categorize columns
  const dimensions = columns
    .filter(c => c.category === 'dimension')
    .map(c => c.name);
  
  const measures = columns
    .filter(c => c.category === 'measure')
    .map(c => c.name);
  
  const temporalColumns = columns
    .filter(c => c.category === 'temporal')
    .map(c => c.name);
  
  // Geo columns include both geo_point types and lat/lon pairs
  const geoTypeColumns = columns
    .filter(c => c.category === 'geo')
    .map(c => c.name);
  
  const latLonPairs = findLatLonPairs(columns);
  const geoColumns = [...new Set([...geoTypeColumns, ...latLonPairs])];
  
  // Check for _cluster column
  const hasClusterColumn = columns.some(c => c.name === '_cluster');
  
  // Determine compatible chart types
  const compatibleChartTypes = getCompatibleChartTypes({
    columns,
    dimensions,
    measures,
    temporalColumns,
    geoColumns,
    hasClusterColumn,
    recommendedChartType: null,
    compatibleChartTypes: [],
  });
  
  // Recommend best chart type
  const recommendedChartType = recommendChartType({
    columns,
    dimensions,
    measures,
    temporalColumns,
    geoColumns,
    hasClusterColumn,
    recommendedChartType: null,
    compatibleChartTypes,
  });
  
  return {
    columns,
    dimensions,
    measures,
    temporalColumns,
    geoColumns,
    hasClusterColumn,
    recommendedChartType,
    compatibleChartTypes,
  };
}

/**
 * Get compatible chart types based on schema analysis
 * Requirements: 1.5, 2.3, 3.1
 */
export function getCompatibleChartTypes(analysis: SchemaAnalysis): ChartType[] {
  const compatible: ChartType[] = [];
  
  // Pie chart: requires dimension + measure
  if (analysis.dimensions.length > 0 && analysis.measures.length > 0) {
    compatible.push('pie');
  }
  
  // Bar chart: requires dimension + measure
  if (analysis.dimensions.length > 0 && analysis.measures.length > 0) {
    compatible.push('bar');
  }
  
  // Histogram: requires temporal column
  if (analysis.temporalColumns.length > 0) {
    compatible.push('histogram');
  }
  
  // Map: requires geo columns
  if (analysis.geoColumns.length > 0) {
    compatible.push('map');
  }
  
  return compatible;
}

/**
 * Recommend the best chart type based on schema analysis
 * Requirements: 3.6
 */
export function recommendChartType(analysis: SchemaAnalysis): ChartType | null {
  // Priority: histogram (time-series) > map (geo) > bar > pie
  
  // If we have temporal data, histogram is usually most useful
  if (analysis.temporalColumns.length > 0) {
    return 'histogram';
  }
  
  // If we have geo data, map is most appropriate
  if (analysis.geoColumns.length > 0) {
    return 'map';
  }
  
  // For categorical + numeric, prefer bar chart (more versatile than pie)
  if (analysis.dimensions.length > 0 && analysis.measures.length > 0) {
    return 'bar';
  }
  
  return null;
}

/**
 * Suggest default configuration for a chart type
 * Requirements: 8.1
 */
export function suggestConfiguration(
  analysis: SchemaAnalysis,
  chartType: ChartType
): ChartConfig {
  switch (chartType) {
    case 'pie': {
      const dimension = analysis.dimensions[0] || '';
      const measure = analysis.measures[0] || '';
      return {
        ...DEFAULT_PIE_CONFIG,
        dimensionColumn: dimension,
        measureColumn: measure,
      } as PieChartConfig;
    }
    
    case 'bar': {
      const xColumn = analysis.dimensions[0] || '';
      const yColumn = analysis.measures[0] || '';
      return {
        ...DEFAULT_BAR_CONFIG,
        xColumn,
        yColumn,
      } as BarChartConfig;
    }
    
    case 'histogram': {
      const timeColumn = analysis.temporalColumns[0] || '';
      const measureColumn = analysis.measures.length > 0 ? analysis.measures[0] : undefined;
      return {
        ...DEFAULT_HISTOGRAM_CONFIG,
        timeColumn,
        measureColumn,
      } as HistogramConfig;
    }
    
    case 'map': {
      // Check for geo_point column first
      const geoPointColumn = analysis.columns.find(
        c => c.category === 'geo' && isGeoType(c.type)
      );
      
      if (geoPointColumn) {
        return {
          ...DEFAULT_MAP_CONFIG,
          geoColumn: geoPointColumn.name,
        } as GeoMapConfig;
      }
      
      // Fall back to lat/lon columns
      const latColumn = analysis.columns.find(c => isLatitudeColumn(c.name))?.name;
      const lonColumn = analysis.columns.find(c => isLongitudeColumn(c.name))?.name;
      
      return {
        ...DEFAULT_MAP_CONFIG,
        latColumn,
        lonColumn,
      } as GeoMapConfig;
    }
  }
}

/**
 * Get the reason why a chart type is disabled
 */
export function getDisabledReason(
  analysis: SchemaAnalysis,
  chartType: ChartType
): string | undefined {
  switch (chartType) {
    case 'pie':
    case 'bar':
      if (analysis.dimensions.length === 0 && analysis.measures.length === 0) {
        return 'Requires at least one categorical column and one numeric column';
      }
      if (analysis.dimensions.length === 0) {
        return 'Requires at least one categorical column for grouping';
      }
      if (analysis.measures.length === 0) {
        return 'Requires at least one numeric column for values';
      }
      return undefined;
    
    case 'histogram':
      if (analysis.temporalColumns.length === 0) {
        return 'Requires at least one date/time column';
      }
      return undefined;
    
    case 'map':
      if (analysis.geoColumns.length === 0) {
        return 'Requires geo_point column or latitude/longitude columns';
      }
      return undefined;
  }
}
