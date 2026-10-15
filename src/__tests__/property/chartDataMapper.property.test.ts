// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for ChartDataMapper
 * Feature: d3-chart-visualizations
 * Properties 11, 13, 14, 15, 16: Data transformation properties
 * Validates: Requirements 4.7, 5.6, 5.7, 6.5, 6.8, 7.6, 10.3, 10.4, 10.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PPLColumn } from '../../types/cell';
import type { ConsolidatedRow } from '../../types/investigation';
import type { PieChartConfig, BarChartConfig, HistogramConfig, GeoMapConfig } from '../../types/chart';
import {
  mapToPieData,
  mapToBarDataGroupedByCluster,
  mapToHistogramData,
  mapToGeoData,
  calculateAutoInterval,
  getClusterColor,
  CLUSTER_COLORS,
} from '../../services/chartDataMapper';

// Generators

const clusterNameArb = fc.constantFrom('cluster-1', 'cluster-2', 'cluster-3', 'cluster-4', 'cluster-5');

const geoPointArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true }),
});

describe('Feature: d3-chart-visualizations - Chart Data Mapper', () => {
  describe('Property 11: Pie Chart Slice Grouping', () => {
    it('should never produce more than maxSlices + 1 data points', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }), // maxSlices
          fc.integer({ min: 1, max: 30 }), // number of unique categories
          fc.integer({ min: 10, max: 100 }), // number of rows
          (maxSlices, numCategories, numRows) => {
            const categories = Array.from({ length: numCategories }, (_, i) => `Category_${i}`);
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = Array.from({ length: numRows }, () => ({
              _cluster: 'cluster-1',
              data: [
                categories[Math.floor(Math.random() * categories.length)],
                Math.random() * 1000,
              ],
            }));
            
            const config: PieChartConfig = {
              type: 'pie',
              dimensionColumn: 'category',
              measureColumn: 'value',
              maxSlices,
              showLegend: true,
              showPercentages: true,
            };
            
            const result = mapToPieData(rows, config, schema);
            
            // Should never exceed maxSlices + 1 (for "Other")
            expect(result.length).toBeLessThanOrEqual(maxSlices + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should group excess categories into "Other"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 8 }), // maxSlices
          (maxSlices) => {
            // Create more categories than maxSlices
            const numCategories = maxSlices + 5;
            const categories = Array.from({ length: numCategories }, (_, i) => `Cat_${i}`);
            
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            // Create rows with each category having different values
            const rows: ConsolidatedRow[] = categories.map((cat, i) => ({
              _cluster: 'cluster-1',
              data: [cat, (numCategories - i) * 100], // Decreasing values
            }));
            
            const config: PieChartConfig = {
              type: 'pie',
              dimensionColumn: 'category',
              measureColumn: 'value',
              maxSlices,
              showLegend: true,
              showPercentages: true,
            };
            
            const result = mapToPieData(rows, config, schema);
            
            // Should have exactly maxSlices + 1 (including "Other")
            expect(result.length).toBe(maxSlices + 1);
            
            // Last item should be "Other"
            const lastItem = result[result.length - 1];
            expect(lastItem?.label).toBe('Other');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve total value when grouping into "Other"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 8 }),
          fc.array(fc.double({ min: 1, max: 1000, noNaN: true }), { minLength: 15, maxLength: 20 }),
          (maxSlices, values) => {
            const categories = values.map((_, i) => `Cat_${i}`);
            
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = values.map((val, i) => ({
              _cluster: 'cluster-1',
              data: [categories[i], val],
            }));
            
            const config: PieChartConfig = {
              type: 'pie',
              dimensionColumn: 'category',
              measureColumn: 'value',
              maxSlices,
              showLegend: true,
              showPercentages: true,
            };
            
            const result = mapToPieData(rows, config, schema);
            
            // Total value should be preserved
            const inputTotal = values.reduce((sum, v) => sum + v, 0);
            const outputTotal = result.reduce((sum, d) => sum + d.value, 0);
            
            expect(outputTotal).toBeCloseTo(inputTotal, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have percentages that sum to 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 1, max: 1000, noNaN: true }), { minLength: 3, maxLength: 15 }),
          (values) => {
            const categories = values.map((_, i) => `Cat_${i}`);
            
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = values.map((val, i) => ({
              _cluster: 'cluster-1',
              data: [categories[i], val],
            }));
            
            const config: PieChartConfig = {
              type: 'pie',
              dimensionColumn: 'category',
              measureColumn: 'value',
              maxSlices: 10,
              showLegend: true,
              showPercentages: true,
            };
            
            const result = mapToPieData(rows, config, schema);
            
            const totalPercentage = result.reduce((sum, d) => sum + d.percentage, 0);
            expect(totalPercentage).toBeCloseTo(100, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Bar Chart Cluster Modes', () => {
    it('should produce data points for each category-cluster combination when grouped', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('A', 'B', 'C', 'D'), { minLength: 2, maxLength: 4 }),
          fc.array(clusterNameArb, { minLength: 2, maxLength: 4 }),
          (categories, clusters) => {
            const uniqueCategories = [...new Set(categories)];
            const uniqueClusters = [...new Set(clusters)];
            
            fc.pre(uniqueCategories.length >= 2 && uniqueClusters.length >= 2);
            
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            // Create rows with various category-cluster combinations
            const rows: ConsolidatedRow[] = [];
            for (const cat of uniqueCategories) {
              for (const cluster of uniqueClusters) {
                rows.push({
                  _cluster: cluster,
                  data: [cat, Math.random() * 100],
                });
              }
            }
            
            const config: BarChartConfig = {
              type: 'bar',
              xColumn: 'category',
              yColumn: 'value',
              orientation: 'vertical',
              groupByCluster: true,
              stacked: false,
              showLegend: true,
            };
            
            const result = mapToBarDataGroupedByCluster(rows, config, schema);
            
            // Should have data point for each category-cluster combination
            expect(result.length).toBe(uniqueCategories.length * uniqueClusters.length);
            
            // Each cluster should have consistent color
            const clusterColors = new Map<string, string>();
            for (const point of result) {
              if (point.cluster) {
                if (clusterColors.has(point.cluster)) {
                  expect(point.color).toBe(clusterColors.get(point.cluster));
                } else {
                  clusterColors.set(point.cluster, point.color);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign distinct colors to different clusters', () => {
      fc.assert(
        fc.property(
          fc.array(clusterNameArb, { minLength: 2, maxLength: 5 }),
          (clusters) => {
            const uniqueClusters = [...new Set(clusters)];
            fc.pre(uniqueClusters.length >= 2);
            
            const schema: PPLColumn[] = [
              { name: 'category', type: 'keyword' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = uniqueClusters.map(cluster => ({
              _cluster: cluster,
              data: ['A', 100],
            }));
            
            const config: BarChartConfig = {
              type: 'bar',
              xColumn: 'category',
              yColumn: 'value',
              orientation: 'vertical',
              groupByCluster: true,
              stacked: false,
              showLegend: true,
            };
            
            const result = mapToBarDataGroupedByCluster(rows, config, schema);
            
            // Collect colors per cluster
            const clusterColors = new Map<string, string>();
            for (const point of result) {
              if (point.cluster) {
                clusterColors.set(point.cluster, point.color);
              }
            }
            
            // Different clusters should have different colors (up to palette size)
            const colors = [...clusterColors.values()];
            const uniqueColors = new Set(colors);
            
            // Should have as many unique colors as clusters (up to palette limit)
            const expectedUniqueColors = Math.min(uniqueClusters.length, CLUSTER_COLORS.length);
            expect(uniqueColors.size).toBe(expectedUniqueColors);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: Histogram Cluster Support', () => {
    it('should produce separate time series per cluster when grouped', () => {
      fc.assert(
        fc.property(
          fc.array(clusterNameArb, { minLength: 2, maxLength: 4 }),
          fc.array(
            fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31'), noInvalidDate: true }),
            { minLength: 10, maxLength: 30 }
          ),
          (clusters, timestamps) => {
            const uniqueClusters = [...new Set(clusters)];
            fc.pre(uniqueClusters.length >= 2);
            
            const schema: PPLColumn[] = [
              { name: 'timestamp', type: 'timestamp' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = timestamps.map((ts, i) => ({
              _cluster: uniqueClusters[i % uniqueClusters.length] ?? 'cluster-1',
              data: [ts.toISOString(), Math.random() * 100],
            }));
            
            const config: HistogramConfig = {
              type: 'histogram',
              timeColumn: 'timestamp',
              measureColumn: 'value',
              interval: 'day',
              groupByCluster: true,
              stacked: false,
              showLegend: true,
            };
            
            const result = mapToHistogramData(rows, config, schema);
            
            // Each bucket should have entries for each cluster
            const bucketsByTime = new Map<string, Set<string>>();
            for (const bucket of result) {
              const timeKey = bucket.startTime.toISOString();
              if (!bucketsByTime.has(timeKey)) {
                bucketsByTime.set(timeKey, new Set());
              }
              if (bucket.cluster) {
                bucketsByTime.get(timeKey)!.add(bucket.cluster);
              }
            }
            
            // Each time bucket should have all clusters represented
            for (const [, clusterSet] of bucketsByTime) {
              expect(clusterSet.size).toBe(uniqueClusters.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign consistent colors to clusters across buckets', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31'), noInvalidDate: true }),
            { minLength: 20, maxLength: 50 }
          ),
          (timestamps) => {
            const clusters = ['cluster-1', 'cluster-2', 'cluster-3'];
            
            const schema: PPLColumn[] = [
              { name: 'timestamp', type: 'timestamp' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = timestamps.map((ts, i) => ({
              _cluster: clusters[i % clusters.length] ?? 'cluster-1',
              data: [ts.toISOString(), Math.random() * 100],
            }));
            
            const config: HistogramConfig = {
              type: 'histogram',
              timeColumn: 'timestamp',
              interval: 'day',
              groupByCluster: true,
              stacked: false,
              showLegend: true,
            };
            
            const result = mapToHistogramData(rows, config, schema);
            
            // Verify consistent colors per cluster
            const clusterColors = new Map<string, string>();
            for (const bucket of result) {
              if (bucket.cluster) {
                if (clusterColors.has(bucket.cluster)) {
                  expect(bucket.color).toBe(clusterColors.get(bucket.cluster));
                } else {
                  clusterColors.set(bucket.cluster, bucket.color);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Map Cluster Coloring', () => {
    it('should assign consistent colors to clusters for geo points', () => {
      fc.assert(
        fc.property(
          fc.array(geoPointArb, { minLength: 10, maxLength: 30 }),
          fc.array(clusterNameArb, { minLength: 2, maxLength: 4 }),
          (geoPoints, clusters) => {
            const uniqueClusters = [...new Set(clusters)];
            fc.pre(uniqueClusters.length >= 2);
            
            const schema: PPLColumn[] = [
              { name: 'location', type: 'geo_point' },
              { name: 'value', type: 'double' },
            ];
            
            const rows: ConsolidatedRow[] = geoPoints.map((geo, i) => ({
              _cluster: uniqueClusters[i % uniqueClusters.length] ?? 'cluster-1',
              data: [geo, Math.random() * 100],
            }));
            
            const config: GeoMapConfig = {
              type: 'map',
              geoColumn: 'location',
              colorByCluster: true,
              markerSize: 'fixed',
            };
            
            const result = mapToGeoData(rows, config, schema);
            
            // Verify consistent colors per cluster
            const clusterColors = new Map<string, string>();
            for (const point of result) {
              if (point.cluster) {
                if (clusterColors.has(point.cluster)) {
                  expect(point.color).toBe(clusterColors.get(point.cluster));
                } else {
                  clusterColors.set(point.cluster, point.color);
                }
              }
            }
            
            // Different clusters should have different colors
            const colors = [...clusterColors.values()];
            const uniqueColors = new Set(colors);
            expect(uniqueColors.size).toBe(Math.min(uniqueClusters.length, CLUSTER_COLORS.length));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse various geo_point formats correctly', () => {
      const schema: PPLColumn[] = [
        { name: 'location', type: 'geo_point' },
      ];
      
      // Object format
      const objRows: ConsolidatedRow[] = [{
        _cluster: 'cluster-1',
        data: [{ lat: 40.7128, lon: -74.0060 }],
      }];
      
      const config: GeoMapConfig = {
        type: 'map',
        geoColumn: 'location',
        colorByCluster: false,
        markerSize: 'fixed',
      };
      
      const objResult = mapToGeoData(objRows, config, schema);
      expect(objResult.length).toBe(1);
      expect(objResult[0]?.lat).toBeCloseTo(40.7128, 4);
      expect(objResult[0]?.lon).toBeCloseTo(-74.0060, 4);
      
      // String format
      const strRows: ConsolidatedRow[] = [{
        _cluster: 'cluster-1',
        data: ['40.7128,-74.0060'],
      }];
      
      const strResult = mapToGeoData(strRows, config, schema);
      expect(strResult.length).toBe(1);
      expect(strResult[0]?.lat).toBeCloseTo(40.7128, 4);
      expect(strResult[0]?.lon).toBeCloseTo(-74.0060, 4);
    });
  });

  describe('Property 16: Auto-Interval Calculation', () => {
    it('should produce reasonable bucket counts for any time range', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01'), noInvalidDate: true }),
          fc.integer({ min: 1, max: 365 }), // days to add
          (startDate, daysToAdd) => {
            const endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            
            const interval = calculateAutoInterval(startDate, endDate);
            
            // Calculate approximate bucket count
            const rangeMs = endDate.getTime() - startDate.getTime();
            const intervalMs = {
              minute: 60 * 1000,
              hour: 60 * 60 * 1000,
              day: 24 * 60 * 60 * 1000,
              week: 7 * 24 * 60 * 60 * 1000,
              month: 30 * 24 * 60 * 60 * 1000,
            }[interval];
            
            const bucketCount = rangeMs / intervalMs;
            
            // Should produce reasonable number of buckets (relaxed bounds)
            expect(bucketCount).toBeGreaterThanOrEqual(1);
            // For very short ranges with minute intervals, can have many buckets
            expect(bucketCount).toBeLessThanOrEqual(2000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should select appropriate intervals based on time range', () => {
      // Short range (hours) -> minute
      const hourRange = calculateAutoInterval(
        new Date('2024-01-01T00:00:00'),
        new Date('2024-01-01T02:00:00')
      );
      expect(hourRange).toBe('minute');
      
      // Multi-day range -> hour or day
      const multiDayRange = calculateAutoInterval(
        new Date('2024-01-01'),
        new Date('2024-01-05')
      );
      expect(['minute', 'hour', 'day']).toContain(multiDayRange);
      
      // Week range -> day
      const weekRange = calculateAutoInterval(
        new Date('2024-01-01'),
        new Date('2024-01-14')
      );
      expect(['hour', 'day']).toContain(weekRange);
      
      // Month range -> day or week
      const monthRange = calculateAutoInterval(
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(['day', 'week']).toContain(monthRange);
      
      // Year range -> week or month
      const yearRange = calculateAutoInterval(
        new Date('2024-01-01'),
        new Date('2025-01-01')
      );
      expect(['week', 'month']).toContain(yearRange);
    });
  });

  describe('Cluster Color Consistency', () => {
    it('should return consistent colors for the same cluster name', () => {
      fc.assert(
        fc.property(
          clusterNameArb,
          fc.array(clusterNameArb, { minLength: 1, maxLength: 5 }),
          (targetCluster, otherClusters) => {
            const allClusters = [targetCluster, ...otherClusters];
            
            // Get color multiple times
            const color1 = getClusterColor(targetCluster, allClusters);
            const color2 = getClusterColor(targetCluster, allClusters);
            
            expect(color1).toBe(color2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
