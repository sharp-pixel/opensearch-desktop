// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Chart types and configuration interfaces for D3 visualizations
 * Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1
 */

/**
 * Available chart types
 */
export type ChartType = 'pie' | 'bar' | 'histogram' | 'map';

/**
 * View mode for results display
 */
export type ViewMode = 'table' | 'chart';

/**
 * Base configuration shared by all chart types
 */
export interface BaseChartConfig {
  type: ChartType;
  title?: string;
}

/**
 * Pie chart configuration
 * Requirements: 4.1, 4.2, 4.3, 4.6, 4.7
 */
export interface PieChartConfig extends BaseChartConfig {
  type: 'pie';
  dimensionColumn: string;  // Column for slice labels
  measureColumn: string;    // Column for slice values
  maxSlices: number;        // Max slices before grouping into "Other"
  showLegend: boolean;
  showPercentages: boolean;
}

/**
 * Bar chart configuration
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7
 */
export interface BarChartConfig extends BaseChartConfig {
  type: 'bar';
  xColumn: string;          // Dimension column for X-axis
  yColumn: string;          // Measure column for Y-axis
  orientation: 'vertical' | 'horizontal';
  groupByCluster: boolean;  // Use _cluster for grouped bars
  stacked: boolean;         // Stack bars instead of grouping
  showLegend: boolean;
}

/**
 * Histogram configuration for time-series data
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.8
 */
export interface HistogramConfig extends BaseChartConfig {
  type: 'histogram';
  timeColumn: string;       // Temporal column for X-axis
  measureColumn?: string;   // Optional measure column (defaults to count)
  interval: 'auto' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  groupByCluster: boolean;  // Overlay/stack by cluster
  stacked: boolean;
  showLegend: boolean;
}

/**
 * Geographic map configuration
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
 */
export interface GeoMapConfig extends BaseChartConfig {
  type: 'map';
  geoColumn?: string;       // geo_point column
  latColumn?: string;       // Latitude column (if no geo_point)
  lonColumn?: string;       // Longitude column (if no geo_point)
  measureColumn?: string;   // Optional column for marker size
  colorByCluster: boolean;  // Color markers by _cluster
  markerSize: 'fixed' | 'scaled';
}

/**
 * Union type for all chart configurations
 */
export type ChartConfig = PieChartConfig | BarChartConfig | HistogramConfig | GeoMapConfig;

/**
 * Column category for schema analysis
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */
export type ColumnCategory = 
  | 'dimension'    // Categorical/string columns
  | 'measure'      // Numeric columns
  | 'temporal'     // Date/time columns
  | 'geo'          // Geographic columns
  | 'unknown';

/**
 * Analysis result for a single column
 */
export interface ColumnAnalysis {
  name: string;
  type: string;
  category: ColumnCategory;
  cardinality?: number;     // Unique value count (for dimensions)
  hasNulls: boolean;
  sampleValues?: unknown[];
}

/**
 * Complete schema analysis result
 * Requirements: 3.1, 3.6
 */
export interface SchemaAnalysis {
  columns: ColumnAnalysis[];
  dimensions: string[];     // Column names suitable as dimensions
  measures: string[];       // Column names suitable as measures
  temporalColumns: string[];
  geoColumns: string[];
  hasClusterColumn: boolean;
  recommendedChartType: ChartType | null;
  compatibleChartTypes: ChartType[];
}

/**
 * Pie chart data point
 */
export interface PieDataPoint {
  label: string;
  value: number;
  percentage: number;
  color: string;
  cluster?: string;
}

/**
 * Bar chart data point
 */
export interface BarDataPoint {
  category: string;
  value: number;
  cluster?: string;
  color: string;
}

/**
 * Histogram bucket for time-series data
 */
export interface HistogramBucket {
  startTime: Date;
  endTime: Date;
  value: number;
  cluster?: string;
  color: string;
}

/**
 * Geographic data point
 */
export interface GeoDataPoint {
  lat: number;
  lon: number;
  value?: number;
  label: string;
  cluster?: string;
  color: string;
}

/**
 * Union type for all chart data points
 */
export type ChartDataPoint = PieDataPoint | BarDataPoint | HistogramBucket | GeoDataPoint;

/**
 * Chart state for a cell
 */
export interface ChartState {
  viewMode: ViewMode;
  chartType: ChartType;
  config: ChartConfig;
  schemaAnalysis?: SchemaAnalysis;
}

/**
 * Theme-aware chart color palette
 * Requirements: 9.1, 9.2
 */
export interface ChartColorPalette {
  primary: string[];      // Main data series colors
  cluster: string[];      // Colors for cluster comparison
  background: string;
  text: string;
  axis: string;
  grid: string;
  border: string;         // Border color for UI elements
  surface: string;        // Surface color for UI elements
  tooltip: {
    background: string;
    text: string;
    border: string;
  };
}

/**
 * Chart type option for the type selector
 */
export interface ChartTypeOption {
  type: ChartType;
  label: string;
  enabled: boolean;
  recommended: boolean;
  disabledReason?: string;
}

/**
 * Default configurations for each chart type
 */
export const DEFAULT_PIE_CONFIG: Omit<PieChartConfig, 'dimensionColumn' | 'measureColumn'> = {
  type: 'pie',
  maxSlices: 10,
  showLegend: true,
  showPercentages: true,
};

export const DEFAULT_BAR_CONFIG: Omit<BarChartConfig, 'xColumn' | 'yColumn'> = {
  type: 'bar',
  orientation: 'vertical',
  groupByCluster: false,
  stacked: false,
  showLegend: true,
};

export const DEFAULT_HISTOGRAM_CONFIG: Omit<HistogramConfig, 'timeColumn'> = {
  type: 'histogram',
  interval: 'auto',
  groupByCluster: false,
  stacked: false,
  showLegend: true,
};

export const DEFAULT_MAP_CONFIG: Omit<GeoMapConfig, 'geoColumn' | 'latColumn' | 'lonColumn'> = {
  type: 'map',
  colorByCluster: false,
  markerSize: 'fixed',
};
