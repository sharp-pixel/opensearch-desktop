// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for chart configuration
 * Feature: d3-chart-visualizations
 * Property 10: Configuration Persistence Round-Trip
 * Validates: Requirements 1.4, 2.5, 8.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  ChartConfig,
  PieChartConfig,
  BarChartConfig,
  HistogramConfig,
  GeoMapConfig,
} from '../../types/chart';

// Generators for chart configurations

const pieChartConfigArb = fc.record({
  type: fc.constant('pie' as const),
  title: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  dimensionColumn: fc.string({ minLength: 1, maxLength: 50 }),
  measureColumn: fc.string({ minLength: 1, maxLength: 50 }),
  maxSlices: fc.integer({ min: 1, max: 100 }),
  showLegend: fc.boolean(),
  showPercentages: fc.boolean(),
}) as fc.Arbitrary<PieChartConfig>;

const barChartConfigArb = fc.record({
  type: fc.constant('bar' as const),
  title: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  xColumn: fc.string({ minLength: 1, maxLength: 50 }),
  yColumn: fc.string({ minLength: 1, maxLength: 50 }),
  orientation: fc.constantFrom('vertical' as const, 'horizontal' as const),
  groupByCluster: fc.boolean(),
  stacked: fc.boolean(),
  showLegend: fc.boolean(),
}) as fc.Arbitrary<BarChartConfig>;

const histogramConfigArb = fc.record({
  type: fc.constant('histogram' as const),
  title: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  timeColumn: fc.string({ minLength: 1, maxLength: 50 }),
  measureColumn: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  interval: fc.constantFrom('auto' as const, 'minute' as const, 'hour' as const, 'day' as const, 'week' as const, 'month' as const),
  groupByCluster: fc.boolean(),
  stacked: fc.boolean(),
  showLegend: fc.boolean(),
}) as fc.Arbitrary<HistogramConfig>;

const geoMapConfigArb = fc.record({
  type: fc.constant('map' as const),
  title: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  geoColumn: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  latColumn: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  lonColumn: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  measureColumn: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  colorByCluster: fc.boolean(),
  markerSize: fc.constantFrom('fixed' as const, 'scaled' as const),
}) as fc.Arbitrary<GeoMapConfig>;

const chartConfigArb: fc.Arbitrary<ChartConfig> = fc.oneof(
  pieChartConfigArb,
  barChartConfigArb,
  histogramConfigArb,
  geoMapConfigArb
);

describe('Feature: d3-chart-visualizations - Chart Configuration', () => {
  describe('Property 10: Configuration Persistence Round-Trip', () => {
    it('should preserve pie chart config through JSON serialization', () => {
      fc.assert(
        fc.property(pieChartConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as PieChartConfig;
          
          expect(deserialized.type).toBe(config.type);
          expect(deserialized.dimensionColumn).toBe(config.dimensionColumn);
          expect(deserialized.measureColumn).toBe(config.measureColumn);
          expect(deserialized.maxSlices).toBe(config.maxSlices);
          expect(deserialized.showLegend).toBe(config.showLegend);
          expect(deserialized.showPercentages).toBe(config.showPercentages);
          expect(deserialized.title).toBe(config.title);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve bar chart config through JSON serialization', () => {
      fc.assert(
        fc.property(barChartConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as BarChartConfig;
          
          expect(deserialized.type).toBe(config.type);
          expect(deserialized.xColumn).toBe(config.xColumn);
          expect(deserialized.yColumn).toBe(config.yColumn);
          expect(deserialized.orientation).toBe(config.orientation);
          expect(deserialized.groupByCluster).toBe(config.groupByCluster);
          expect(deserialized.stacked).toBe(config.stacked);
          expect(deserialized.showLegend).toBe(config.showLegend);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve histogram config through JSON serialization', () => {
      fc.assert(
        fc.property(histogramConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as HistogramConfig;
          
          expect(deserialized.type).toBe(config.type);
          expect(deserialized.timeColumn).toBe(config.timeColumn);
          expect(deserialized.measureColumn).toBe(config.measureColumn);
          expect(deserialized.interval).toBe(config.interval);
          expect(deserialized.groupByCluster).toBe(config.groupByCluster);
          expect(deserialized.stacked).toBe(config.stacked);
          expect(deserialized.showLegend).toBe(config.showLegend);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve geo map config through JSON serialization', () => {
      fc.assert(
        fc.property(geoMapConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as GeoMapConfig;
          
          expect(deserialized.type).toBe(config.type);
          expect(deserialized.geoColumn).toBe(config.geoColumn);
          expect(deserialized.latColumn).toBe(config.latColumn);
          expect(deserialized.lonColumn).toBe(config.lonColumn);
          expect(deserialized.measureColumn).toBe(config.measureColumn);
          expect(deserialized.colorByCluster).toBe(config.colorByCluster);
          expect(deserialized.markerSize).toBe(config.markerSize);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve any chart config type through JSON serialization', () => {
      fc.assert(
        fc.property(chartConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as ChartConfig;
          
          // Type should always be preserved
          expect(deserialized.type).toBe(config.type);
          
          // Deep equality check
          expect(deserialized).toEqual(config);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in column names', () => {
      const specialCharArb = fc.array(
        fc.constantFrom('a', 'b', '_', '-', '.', '@', '#', '$', ' ', '1', '2'),
        { minLength: 1, maxLength: 30 }
      ).map(chars => chars.join(''));

      const specialCharConfigArb = fc.record({
        type: fc.constant('pie' as const),
        dimensionColumn: specialCharArb,
        measureColumn: specialCharArb,
        maxSlices: fc.constant(10),
        showLegend: fc.constant(true),
        showPercentages: fc.constant(true),
      }) as fc.Arbitrary<PieChartConfig>;

      fc.assert(
        fc.property(specialCharConfigArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as PieChartConfig;
          
          expect(deserialized.dimensionColumn).toBe(config.dimensionColumn);
          expect(deserialized.measureColumn).toBe(config.measureColumn);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle unicode characters in titles', () => {
      const unicodeTitleArb = fc.record({
        type: fc.constant('bar' as const),
        title: fc.string({ minLength: 1, maxLength: 50, unit: 'grapheme-composite' }),
        xColumn: fc.constant('category'),
        yColumn: fc.constant('value'),
        orientation: fc.constant('vertical' as const),
        groupByCluster: fc.constant(false),
        stacked: fc.constant(false),
        showLegend: fc.constant(true),
      }) as fc.Arbitrary<BarChartConfig>;

      fc.assert(
        fc.property(unicodeTitleArb, (config) => {
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as BarChartConfig;
          
          expect(deserialized.title).toBe(config.title);
        }),
        { numRuns: 100 }
      );
    });
  });
});
