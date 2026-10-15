// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Chart color utilities for D3 visualizations
 * Provides theme-aware color palettes for charts
 * Requirements: 9.1, 9.2, 10.2
 */

import type { ThemeColors } from '../context/ThemeContext';
import type { ChartColorPalette } from '../types/chart';

/**
 * Cluster colors matching FederatedResultsTable
 * These are consistent across table and chart views
 * Requirements: 10.2
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
 * Light mode data series colors
 * Designed for good contrast on light backgrounds
 */
const LIGHT_MODE_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
];

/**
 * Dark mode data series colors
 * Brighter colors for better visibility on dark backgrounds
 */
const DARK_MODE_COLORS = [
  '#60a5fa', // blue
  '#fbbf24', // amber
  '#34d399', // green
  '#f87171', // red
  '#a78bfa', // purple
  '#fb923c', // orange
  '#f472b6', // pink
  '#94a3b8', // gray
  '#a3e635', // lime
  '#22d3ee', // cyan
];

/**
 * Get chart color palette based on theme
 * Requirements: 9.1, 9.2
 */
export function getChartColorPalette(theme: ThemeColors): ChartColorPalette {
  const isDark = theme.monacoTheme === 'vs-dark';
  
  return {
    primary: isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS,
    cluster: CLUSTER_COLORS,
    background: theme.surface,
    text: theme.text,
    axis: theme.textMuted,
    grid: theme.borderLight,
    border: theme.border,
    surface: theme.surface,
    tooltip: {
      background: theme.surface,
      text: theme.text,
      border: theme.border,
    },
  };
}

/**
 * Get color for a data series by index
 */
export function getSeriesColor(
  index: number,
  palette: ChartColorPalette
): string {
  return palette.primary[index % palette.primary.length] ?? palette.primary[0] ?? '#3b82f6';
}

/**
 * Get color for a cluster by name
 * Requirements: 10.2
 */
export function getClusterColor(
  clusterName: string,
  clusterNames: string[]
): string {
  const index = clusterNames.indexOf(clusterName);
  const colorIndex = index >= 0 ? index % CLUSTER_COLORS.length : 0;
  return CLUSTER_COLORS[colorIndex] ?? '#3b82f6';
}

/**
 * Check if a color has sufficient contrast against a background
 * Uses relative luminance calculation
 */
export function hasAdequateContrast(
  foreground: string,
  background: string,
  minRatio = 4.5
): boolean {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);
  
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  const contrastRatio = (lighter + 0.05) / (darker + 0.05);
  return contrastRatio >= minRatio;
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.0 formula
 */
function getRelativeLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;
  
  const [rVal, gVal, bVal] = [rgb.r, rgb.g, rgb.b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * (rVal ?? 0) + 0.7152 * (gVal ?? 0) + 0.0722 * (bVal ?? 0);
}

/**
 * Convert hex color to RGB
 * Handles both 3-digit (#fff) and 6-digit (#ffffff) formats
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Handle 3-digit hex
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (shorthand && shorthand[1] && shorthand[2] && shorthand[3]) {
    return {
      r: parseInt(shorthand[1] + shorthand[1], 16),
      g: parseInt(shorthand[2] + shorthand[2], 16),
      b: parseInt(shorthand[3] + shorthand[3], 16),
    };
  }
  
  // Handle 6-digit hex
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result[1] && result[2] && result[3]) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return null;
}

/**
 * Generate a color scale for continuous data
 */
export function generateColorScale(
  minValue: number,
  maxValue: number,
  palette: ChartColorPalette
): (value: number) => string {
  const isDark = palette.background.startsWith('#1') || palette.background.startsWith('#2');
  
  // Use a gradient from low to high intensity
  const lowColor = isDark ? '#1e3a5f' : '#e6f1fa';
  const highColor = isDark ? '#60a5fa' : '#1f77b4';
  
  return (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    return interpolateColor(lowColor, highColor, normalized);
  };
}

/**
 * Interpolate between two colors
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return color1;
  
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get "Other" category color (for grouped pie slices)
 */
export function getOtherColor(palette: ChartColorPalette): string {
  const isDark = palette.background.startsWith('#1') || palette.background.startsWith('#2');
  return isDark ? '#6b7280' : '#9ca3af';
}
