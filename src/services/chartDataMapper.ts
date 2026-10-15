// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Chart Data Mapper service for D3 visualizations
 * Transforms federated query results into chart-specific data formats
 * Requirements: 4.1, 4.6, 4.7, 5.1, 5.6, 5.7, 6.1, 6.4, 6.5, 6.8, 7.1, 7.6
 */

import type { PPLColumn } from '../types/cell';
import type { ConsolidatedRow } from '../types/investigation';
import type {
  PieChartConfig,
  BarChartConfig,
  HistogramConfig,
  GeoMapConfig,
  PieDataPoint,
  BarDataPoint,
  HistogramBucket,
  GeoDataPoint,
} from '../types/chart';

/**
 * Default color palette for charts
 */
const DEFAULT_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

/**
 * Cluster colors matching FederatedResultsTable
 */
export const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * Get column index by name
 */
function getColumnIndex(schema: PPLColumn[], columnName: string): number {
  return schema.findIndex(col => col.name === columnName);
}

/**
 * Get value from row by column name
 */
function getValue(row: ConsolidatedRow, schema: PPLColumn[], columnName: string): unknown {
  const index = getColumnIndex(schema, columnName);
  return index >= 0 ? row.data[index] : undefined;
}

/**
 * Convert value to number, handling various types
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Convert value to string for labels
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Get color for a value from palette
 */
function getColor(index: number, palette: string[] = DEFAULT_COLORS): string {
  return palette[index % palette.length] ?? DEFAULT_COLORS[0] ?? '#1f77b4';
}

/**
 * Get cluster color by cluster name
 */
export function getClusterColor(clusterName: string, clusterNames: string[]): string {
  const index = clusterNames.indexOf(clusterName);
  const colorIndex = index >= 0 ? index % CLUSTER_COLORS.length : 0;
  return CLUSTER_COLORS[colorIndex] ?? '#3b82f6';
}

/**
 * Map data to pie chart format
 * Requirements: 4.1, 4.6, 4.7
 */
export function mapToPieData(
  rows: ConsolidatedRow[],
  config: PieChartConfig,
  schema: PPLColumn[]
): PieDataPoint[] {
  const { dimensionColumn, measureColumn, maxSlices } = config;
  
  // Aggregate values by dimension
  const aggregated = new Map<string, number>();
  
  for (const row of rows) {
    const dimValue = toString(getValue(row, schema, dimensionColumn));
    const measValue = toNumber(getValue(row, schema, measureColumn));
    
    aggregated.set(dimValue, (aggregated.get(dimValue) || 0) + measValue);
  }
  
  // Convert to array and sort by value descending
  let dataPoints = Array.from(aggregated.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  
  // Group smaller slices into "Other" if exceeding maxSlices
  // Requirements: 4.7
  if (dataPoints.length > maxSlices) {
    const topSlices = dataPoints.slice(0, maxSlices);
    const otherSlices = dataPoints.slice(maxSlices);
    const otherValue = otherSlices.reduce((sum, d) => sum + d.value, 0);
    
    dataPoints = [...topSlices, { label: 'Other', value: otherValue }];
  }
  
  // Calculate total for percentages
  const total = dataPoints.reduce((sum, d) => sum + d.value, 0);
  
  // Add percentages and colors
  return dataPoints.map((d, index) => ({
    label: d.label,
    value: d.value,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
    color: getColor(index),
  }));
}

/**
 * Map data to pie chart format with cluster grouping
 * Requirements: 4.6
 */
export function mapToPieDataByCluster(
  rows: ConsolidatedRow[],
  config: PieChartConfig,
  schema: PPLColumn[]
): PieDataPoint[] {
  const { measureColumn, maxSlices } = config;
  
  // Get unique cluster names
  const clusterNames = [...new Set(rows.map(r => r._cluster))];
  
  // Aggregate values by cluster
  const aggregated = new Map<string, number>();
  
  for (const row of rows) {
    const measValue = toNumber(getValue(row, schema, measureColumn));
    aggregated.set(row._cluster, (aggregated.get(row._cluster) || 0) + measValue);
  }
  
  // Convert to array and sort by value descending
  let dataPoints = Array.from(aggregated.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  
  // Group smaller slices into "Other" if exceeding maxSlices
  if (dataPoints.length > maxSlices) {
    const topSlices = dataPoints.slice(0, maxSlices);
    const otherSlices = dataPoints.slice(maxSlices);
    const otherValue = otherSlices.reduce((sum, d) => sum + d.value, 0);
    
    dataPoints = [...topSlices, { label: 'Other', value: otherValue }];
  }
  
  // Calculate total for percentages
  const total = dataPoints.reduce((sum, d) => sum + d.value, 0);
  
  // Add percentages and cluster colors
  return dataPoints.map((d) => ({
    label: d.label,
    value: d.value,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
    color: d.label === 'Other' ? '#9ca3af' : getClusterColor(d.label, clusterNames),
    cluster: d.label === 'Other' ? undefined : d.label,
  }));
}

/**
 * Map data to bar chart format
 * Requirements: 5.1
 */
export function mapToBarData(
  rows: ConsolidatedRow[],
  config: BarChartConfig,
  schema: PPLColumn[]
): BarDataPoint[] {
  const { xColumn, yColumn, groupByCluster } = config;
  
  if (groupByCluster) {
    return mapToBarDataGroupedByCluster(rows, config, schema);
  }
  
  // Aggregate values by category
  const aggregated = new Map<string, number>();
  
  for (const row of rows) {
    const category = toString(getValue(row, schema, xColumn));
    const value = toNumber(getValue(row, schema, yColumn));
    
    aggregated.set(category, (aggregated.get(category) || 0) + value);
  }
  
  // Convert to array
  return Array.from(aggregated.entries()).map(([category, value], index) => ({
    category,
    value,
    color: getColor(index),
  }));
}

/**
 * Map data to bar chart format with cluster grouping
 * Requirements: 5.6, 5.7
 */
export function mapToBarDataGroupedByCluster(
  rows: ConsolidatedRow[],
  config: BarChartConfig,
  schema: PPLColumn[]
): BarDataPoint[] {
  const { xColumn, yColumn } = config;
  
  // Get unique cluster names
  const clusterNames = [...new Set(rows.map(r => r._cluster))].sort();
  
  // Aggregate values by category and cluster
  const aggregated = new Map<string, Map<string, number>>();
  
  for (const row of rows) {
    const category = toString(getValue(row, schema, xColumn));
    const value = toNumber(getValue(row, schema, yColumn));
    const cluster = row._cluster;
    
    if (!aggregated.has(category)) {
      aggregated.set(category, new Map());
    }
    const clusterMap = aggregated.get(category)!;
    clusterMap.set(cluster, (clusterMap.get(cluster) || 0) + value);
  }
  
  // Convert to flat array with cluster info
  const dataPoints: BarDataPoint[] = [];
  
  for (const [category, clusterMap] of aggregated) {
    for (const cluster of clusterNames) {
      const value = clusterMap.get(cluster) || 0;
      dataPoints.push({
        category,
        value,
        cluster,
        color: getClusterColor(cluster, clusterNames),
      });
    }
  }
  
  return dataPoints;
}

/**
 * Time interval in milliseconds
 */
const INTERVAL_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000, // Approximate
};

/**
 * Calculate auto interval based on time range
 * Requirements: 6.5
 */
export function calculateAutoInterval(
  minTime: Date,
  maxTime: Date
): 'minute' | 'hour' | 'day' | 'week' | 'month' {
  const rangeMs = maxTime.getTime() - minTime.getTime();
  
  // Target 20-50 buckets
  const targetBuckets = 30;
  const idealIntervalMs = rangeMs / targetBuckets;
  
  const hourMs = INTERVAL_MS.hour ?? 3600000;
  const dayMs = INTERVAL_MS.day ?? 86400000;
  const weekMs = INTERVAL_MS.week ?? 604800000;
  const monthMs = INTERVAL_MS.month ?? 2592000000;
  
  if (idealIntervalMs < hourMs) {
    return 'minute';
  } else if (idealIntervalMs < dayMs) {
    return 'hour';
  } else if (idealIntervalMs < weekMs) {
    return 'day';
  } else if (idealIntervalMs < monthMs) {
    return 'week';
  } else {
    return 'month';
  }
}

/**
 * Get bucket start time for a given timestamp
 */
function getBucketStart(
  timestamp: Date,
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month'
): Date {
  const date = new Date(timestamp);
  
  switch (interval) {
    case 'minute':
      date.setSeconds(0, 0);
      break;
    case 'hour':
      date.setMinutes(0, 0, 0);
      break;
    case 'day':
      date.setHours(0, 0, 0, 0);
      break;
    case 'week':
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - date.getDay());
      break;
    case 'month':
      date.setHours(0, 0, 0, 0);
      date.setDate(1);
      break;
  }
  
  return date;
}

/**
 * Get bucket end time
 */
function getBucketEnd(
  bucketStart: Date,
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month'
): Date {
  const end = new Date(bucketStart);
  
  switch (interval) {
    case 'minute':
      end.setMinutes(end.getMinutes() + 1);
      break;
    case 'hour':
      end.setHours(end.getHours() + 1);
      break;
    case 'day':
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      end.setDate(end.getDate() + 7);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      break;
  }
  
  return end;
}

/**
 * Parse timestamp value to Date
 */
function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Map data to histogram format
 * Requirements: 6.1, 6.4, 6.5, 6.8
 */
export function mapToHistogramData(
  rows: ConsolidatedRow[],
  config: HistogramConfig,
  schema: PPLColumn[]
): HistogramBucket[] {
  const { timeColumn, measureColumn, interval, groupByCluster } = config;
  
  // Parse timestamps and find range
  const timestamps: { date: Date; row: ConsolidatedRow }[] = [];
  
  for (const row of rows) {
    const timeValue = getValue(row, schema, timeColumn);
    const date = parseTimestamp(timeValue);
    if (date) {
      timestamps.push({ date, row });
    }
  }
  
  if (timestamps.length === 0) {
    return [];
  }
  
  // Find time range
  const dates = timestamps.map(t => t.date);
  const minTime = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxTime = new Date(Math.max(...dates.map(d => d.getTime())));
  
  // Determine interval
  const actualInterval = interval === 'auto' 
    ? calculateAutoInterval(minTime, maxTime)
    : interval;
  
  if (groupByCluster) {
    return mapToHistogramDataByCluster(timestamps, actualInterval, measureColumn, schema);
  }
  
  // Aggregate into buckets
  const buckets = new Map<string, { startTime: Date; endTime: Date; value: number }>();
  
  for (const { date, row } of timestamps) {
    const bucketStart = getBucketStart(date, actualInterval);
    const bucketKey = bucketStart.toISOString();
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        startTime: bucketStart,
        endTime: getBucketEnd(bucketStart, actualInterval),
        value: 0,
      });
    }
    
    const bucket = buckets.get(bucketKey)!;
    if (measureColumn) {
      bucket.value += toNumber(getValue(row, schema, measureColumn));
    } else {
      bucket.value += 1; // Count
    }
  }
  
  // Convert to array and sort by time
  return Array.from(buckets.values())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .map((bucket, index) => ({
      ...bucket,
      color: getColor(index),
    }));
}

/**
 * Map data to histogram format with cluster grouping
 * Requirements: 6.8
 */
function mapToHistogramDataByCluster(
  timestamps: { date: Date; row: ConsolidatedRow }[],
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month',
  measureColumn: string | undefined,
  schema: PPLColumn[]
): HistogramBucket[] {
  // Get unique cluster names
  const clusterNames = [...new Set(timestamps.map(t => t.row._cluster))].sort();
  
  // Aggregate into buckets by cluster
  const buckets = new Map<string, Map<string, { startTime: Date; endTime: Date; value: number }>>();
  
  for (const { date, row } of timestamps) {
    const bucketStart = getBucketStart(date, interval);
    const bucketKey = bucketStart.toISOString();
    const cluster = row._cluster;
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, new Map());
    }
    
    const clusterBuckets = buckets.get(bucketKey)!;
    if (!clusterBuckets.has(cluster)) {
      clusterBuckets.set(cluster, {
        startTime: bucketStart,
        endTime: getBucketEnd(bucketStart, interval),
        value: 0,
      });
    }
    
    const bucket = clusterBuckets.get(cluster)!;
    if (measureColumn) {
      bucket.value += toNumber(getValue(row, schema, measureColumn));
    } else {
      bucket.value += 1; // Count
    }
  }
  
  // Convert to flat array with cluster info
  const result: HistogramBucket[] = [];
  
  const sortedBucketKeys = Array.from(buckets.keys()).sort();
  
  for (const bucketKey of sortedBucketKeys) {
    const clusterBuckets = buckets.get(bucketKey)!;
    
    for (const cluster of clusterNames) {
      const bucket = clusterBuckets.get(cluster);
      if (bucket) {
        result.push({
          ...bucket,
          cluster,
          color: getClusterColor(cluster, clusterNames),
        });
      } else {
        // Add zero-value bucket for missing clusters
        const bucketStart = new Date(bucketKey);
        result.push({
          startTime: bucketStart,
          endTime: getBucketEnd(bucketStart, interval),
          value: 0,
          cluster,
          color: getClusterColor(cluster, clusterNames),
        });
      }
    }
  }
  
  return result;
}

/**
 * Parse geo_point value
 */
function parseGeoPoint(value: unknown): { lat: number; lon: number } | null {
  if (!value) return null;
  
  // Handle object format: { lat: number, lon: number }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('lat' in obj && 'lon' in obj) {
      const lat = toNumber(obj.lat);
      const lon = toNumber(obj.lon);
      if (isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }
    // Handle array format: [lon, lat] (GeoJSON order)
    if (Array.isArray(value) && value.length >= 2) {
      const lon = toNumber(value[0]);
      const lat = toNumber(value[1]);
      if (isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }
  }
  
  // Handle string format: "lat,lon"
  if (typeof value === 'string') {
    const parts = value.split(',').map(s => parseFloat(s.trim()));
    const lat = parts[0];
    const lon = parts[1];
    if (parts.length >= 2 && lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      if (isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }
  }
  
  return null;
}

/**
 * Validate coordinate values
 */
function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Map data to geo map format
 * Requirements: 7.1, 7.6
 */
export function mapToGeoData(
  rows: ConsolidatedRow[],
  config: GeoMapConfig,
  schema: PPLColumn[]
): GeoDataPoint[] {
  const { geoColumn, latColumn, lonColumn, measureColumn, colorByCluster } = config;
  
  // Get unique cluster names for coloring
  const clusterNames = [...new Set(rows.map(r => r._cluster))].sort();
  
  const dataPoints: GeoDataPoint[] = [];
  
  for (const row of rows) {
    let lat: number | undefined;
    let lon: number | undefined;
    
    // Try geo_point column first
    if (geoColumn) {
      const geoValue = getValue(row, schema, geoColumn);
      const parsed = parseGeoPoint(geoValue);
      if (parsed) {
        lat = parsed.lat;
        lon = parsed.lon;
      }
    }
    
    // Fall back to lat/lon columns
    if (lat === undefined && latColumn && lonColumn) {
      const latValue = getValue(row, schema, latColumn);
      const lonValue = getValue(row, schema, lonColumn);
      lat = toNumber(latValue);
      lon = toNumber(lonValue);
      
      if (!isValidCoordinate(lat, lon)) {
        continue;
      }
    }
    
    if (lat === undefined || lon === undefined) {
      continue;
    }
    
    // Get measure value for marker size
    const value = measureColumn 
      ? toNumber(getValue(row, schema, measureColumn))
      : undefined;
    
    // Build label from first few columns
    const labelParts: string[] = [];
    for (let i = 0; i < Math.min(3, schema.length); i++) {
      const colValue = row.data[i];
      const colSchema = schema[i];
      if (colValue !== null && colValue !== undefined && colSchema) {
        labelParts.push(`${colSchema.name}: ${toString(colValue)}`);
      }
    }
    
    dataPoints.push({
      lat,
      lon,
      value,
      label: labelParts.join(', '),
      cluster: row._cluster,
      color: colorByCluster 
        ? getClusterColor(row._cluster, clusterNames)
        : getColor(dataPoints.length),
    });
  }
  
  return dataPoints;
}
