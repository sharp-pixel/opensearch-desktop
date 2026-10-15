// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for chart colors
 * Feature: d3-chart-visualizations
 * Properties 12, 17: Theme and cluster color consistency
 * Validates: Requirements 4.6, 9.1, 9.2, 10.1, 10.2, 10.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { lightTheme, darkTheme } from '../../context/ThemeContext';
import {
  getChartColorPalette,
  getClusterColor,
  getSeriesColor,
  hasAdequateContrast,
  CLUSTER_COLORS,
} from '../../utils/chartColors';
import { CLUSTER_COLORS as MAPPER_CLUSTER_COLORS } from '../../services/chartDataMapper';

// Generators

const clusterNameArb = fc.string({ minLength: 1, maxLength: 30 });
const clusterNamesArb = fc.array(clusterNameArb, { minLength: 1, maxLength: 10 });

describe('Feature: d3-chart-visualizations - Chart Colors', () => {
  describe('Property 12: Cluster Grouping Support', () => {
    it('should use consistent cluster colors between chartColors and chartDataMapper', () => {
      // Verify the cluster colors are the same in both modules
      expect(CLUSTER_COLORS).toEqual(MAPPER_CLUSTER_COLORS);
    });

    it('should return consistent colors for the same cluster name', () => {
      fc.assert(
        fc.property(
          clusterNameArb,
          clusterNamesArb,
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

    it('should assign different colors to different clusters (up to palette size)', () => {
      fc.assert(
        fc.property(
          fc.array(clusterNameArb, { minLength: 2, maxLength: CLUSTER_COLORS.length }),
          (clusters) => {
            const uniqueClusters = [...new Set(clusters)];
            fc.pre(uniqueClusters.length >= 2);
            
            const colors = uniqueClusters.map(c => getClusterColor(c, uniqueClusters));
            const uniqueColors = new Set(colors);
            
            // Should have as many unique colors as clusters
            expect(uniqueColors.size).toBe(uniqueClusters.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cycle colors when more clusters than palette size', () => {
      // Create more clusters than colors
      const clusters = Array.from({ length: CLUSTER_COLORS.length + 3 }, (_, i) => `cluster-${i}`);
      
      const colors = clusters.map(c => getClusterColor(c, clusters));
      
      // First and (first + palette size) should have same color
      expect(colors[0]).toBe(colors[CLUSTER_COLORS.length]);
      expect(colors[1]).toBe(colors[CLUSTER_COLORS.length + 1]);
    });
  });

  describe('Property 17: Theme Color Consistency', () => {
    it('should provide adequate contrast for text on background in light mode', () => {
      const palette = getChartColorPalette(lightTheme);
      
      // Text should have good contrast against background
      expect(hasAdequateContrast(palette.text, palette.background)).toBe(true);
      
      // Axis text should have reasonable contrast
      expect(hasAdequateContrast(palette.axis, palette.background, 3)).toBe(true);
    });

    it('should provide adequate contrast for text on background in dark mode', () => {
      const palette = getChartColorPalette(darkTheme);
      
      // Text should have good contrast against background
      expect(hasAdequateContrast(palette.text, palette.background)).toBe(true);
      
      // Axis text should have reasonable contrast
      expect(hasAdequateContrast(palette.axis, palette.background, 3)).toBe(true);
    });

    it('should provide different color palettes for light and dark modes', () => {
      const lightPalette = getChartColorPalette(lightTheme);
      const darkPalette = getChartColorPalette(darkTheme);
      
      // Primary colors should be different
      expect(lightPalette.primary).not.toEqual(darkPalette.primary);
      
      // Backgrounds should be different
      expect(lightPalette.background).not.toBe(darkPalette.background);
      
      // Text colors should be different
      expect(lightPalette.text).not.toBe(darkPalette.text);
    });

    it('should use consistent cluster colors across both themes', () => {
      const lightPalette = getChartColorPalette(lightTheme);
      const darkPalette = getChartColorPalette(darkTheme);
      
      // Cluster colors should be the same in both themes
      expect(lightPalette.cluster).toEqual(darkPalette.cluster);
    });

    it('should provide valid hex colors in palette', () => {
      // Regex that matches both 3-digit and 6-digit hex colors
      const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      
      fc.assert(
        fc.property(
          fc.constantFrom(lightTheme, darkTheme),
          (theme) => {
            const palette = getChartColorPalette(theme);
            
            // Check all primary colors
            for (const color of palette.primary) {
              expect(color).toMatch(hexColorRegex);
            }
            
            // Check all cluster colors
            for (const color of palette.cluster) {
              expect(color).toMatch(hexColorRegex);
            }
            
            // Check other colors
            expect(palette.background).toMatch(hexColorRegex);
            expect(palette.text).toMatch(hexColorRegex);
            expect(palette.axis).toMatch(hexColorRegex);
            expect(palette.grid).toMatch(hexColorRegex);
            expect(palette.tooltip.background).toMatch(hexColorRegex);
            expect(palette.tooltip.text).toMatch(hexColorRegex);
            expect(palette.tooltip.border).toMatch(hexColorRegex);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return colors for any series index', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(lightTheme, darkTheme),
          fc.integer({ min: 0, max: 100 }),
          (theme, index) => {
            const palette = getChartColorPalette(theme);
            const color = getSeriesColor(index, palette);
            
            // Should return a valid color
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
            
            // Should cycle through palette
            const expectedIndex = index % palette.primary.length;
            expect(color).toBe(palette.primary[expectedIndex]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Contrast Validation', () => {
    it('should correctly identify high contrast pairs', () => {
      // Black on white - very high contrast
      expect(hasAdequateContrast('#000000', '#ffffff')).toBe(true);
      
      // White on black - very high contrast
      expect(hasAdequateContrast('#ffffff', '#000000')).toBe(true);
    });

    it('should correctly identify low contrast pairs', () => {
      // Light gray on white - low contrast
      expect(hasAdequateContrast('#cccccc', '#ffffff')).toBe(false);
      
      // Dark gray on black - low contrast
      expect(hasAdequateContrast('#333333', '#000000')).toBe(false);
    });

    it('should handle same color (zero contrast)', () => {
      expect(hasAdequateContrast('#ffffff', '#ffffff')).toBe(false);
      expect(hasAdequateContrast('#000000', '#000000')).toBe(false);
    });
  });
});
