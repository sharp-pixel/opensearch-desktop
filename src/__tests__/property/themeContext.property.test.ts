// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ThemeContext Tests
 * Tests for theme objects and color consistency
 */

import { describe, it, expect } from 'vitest';
import {
  lightTheme,
  darkTheme,
  type ThemeColors,
} from '../../context/ThemeContext';

describe('ThemeContext Tests', () => {
  describe('Theme Objects', () => {
    it('lightTheme has all required properties', () => {
      expect(lightTheme.background).toBeDefined();
      expect(lightTheme.backgroundSecondary).toBeDefined();
      expect(lightTheme.backgroundTertiary).toBeDefined();
      expect(lightTheme.surface).toBeDefined();
      expect(lightTheme.surfaceHover).toBeDefined();
      expect(lightTheme.text).toBeDefined();
      expect(lightTheme.textSecondary).toBeDefined();
      expect(lightTheme.textMuted).toBeDefined();
      expect(lightTheme.border).toBeDefined();
      expect(lightTheme.borderLight).toBeDefined();
      expect(lightTheme.primary).toBeDefined();
      expect(lightTheme.primaryHover).toBeDefined();
      expect(lightTheme.primaryLight).toBeDefined();
      expect(lightTheme.monacoTheme).toBe('vs');
    });

    it('darkTheme has all required properties', () => {
      expect(darkTheme.background).toBeDefined();
      expect(darkTheme.backgroundSecondary).toBeDefined();
      expect(darkTheme.backgroundTertiary).toBeDefined();
      expect(darkTheme.surface).toBeDefined();
      expect(darkTheme.surfaceHover).toBeDefined();
      expect(darkTheme.text).toBeDefined();
      expect(darkTheme.textSecondary).toBeDefined();
      expect(darkTheme.textMuted).toBeDefined();
      expect(darkTheme.border).toBeDefined();
      expect(darkTheme.borderLight).toBeDefined();
      expect(darkTheme.primary).toBeDefined();
      expect(darkTheme.primaryHover).toBeDefined();
      expect(darkTheme.primaryLight).toBeDefined();
      expect(darkTheme.monacoTheme).toBe('vs-dark');
    });


    it('lightTheme and darkTheme have different backgrounds', () => {
      expect(lightTheme.background).not.toBe(darkTheme.background);
    });

    it('lightTheme has light background (high luminance)', () => {
      // Light theme background should be light colored
      const hex = lightTheme.background.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (r + g + b) / 3;
      expect(luminance).toBeGreaterThan(200); // Light colors have high values
    });

    it('darkTheme has dark background (low luminance)', () => {
      // Dark theme background should be dark colored
      const hex = darkTheme.background.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (r + g + b) / 3;
      expect(luminance).toBeLessThan(100); // Dark colors have low values
    });
  });

  describe('Status Colors', () => {
    const statusColors = ['success', 'warning', 'error', 'info'] as const;

    it('lightTheme has all status colors', () => {
      for (const color of statusColors) {
        expect(lightTheme[color]).toBeDefined();
        expect(lightTheme[`${color}Light`]).toBeDefined();
      }
    });

    it('darkTheme has all status colors', () => {
      for (const color of statusColors) {
        expect(darkTheme[color]).toBeDefined();
        expect(darkTheme[`${color}Light`]).toBeDefined();
      }
    });

    it('success colors are green-ish', () => {
      // Success should have more green component
      const lightHex = lightTheme.success.replace('#', '');
      const g = parseInt(lightHex.substring(2, 4), 16);
      expect(g).toBeGreaterThan(100);
    });

    it('error colors are red-ish', () => {
      // Error should have more red component
      const lightHex = lightTheme.error.replace('#', '');
      const r = parseInt(lightHex.substring(0, 2), 16);
      expect(r).toBeGreaterThan(150);
    });
  });


  describe('Theme Color Consistency', () => {
    // Allow both 3-digit (#fff) and 6-digit (#ffffff) hex colors
    const hexColorRegex = /^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/;

    it('all lightTheme color values are valid hex colors', () => {
      for (const [key, value] of Object.entries(lightTheme)) {
        if (key !== 'monacoTheme' && typeof value === 'string') {
          expect(value, `lightTheme.${key}`).toMatch(hexColorRegex);
        }
      }
    });

    it('all darkTheme color values are valid hex colors', () => {
      for (const [key, value] of Object.entries(darkTheme)) {
        if (key !== 'monacoTheme' && typeof value === 'string') {
          expect(value, `darkTheme.${key}`).toMatch(hexColorRegex);
        }
      }
    });

    it('both themes have same keys', () => {
      const lightKeys = Object.keys(lightTheme).sort();
      const darkKeys = Object.keys(darkTheme).sort();
      expect(lightKeys).toEqual(darkKeys);
    });

    it('primary colors are different between themes', () => {
      expect(lightTheme.primary).not.toBe(darkTheme.primary);
    });

    it('text colors are different between themes', () => {
      expect(lightTheme.text).not.toBe(darkTheme.text);
    });

    it('border colors are different between themes', () => {
      expect(lightTheme.border).not.toBe(darkTheme.border);
    });
  });

  describe('Code/Editor Theme', () => {
    it('lightTheme has code background', () => {
      expect(lightTheme.codeBackground).toBeDefined();
      expect(lightTheme.codeBorder).toBeDefined();
    });

    it('darkTheme has code background', () => {
      expect(darkTheme.codeBackground).toBeDefined();
      expect(darkTheme.codeBorder).toBeDefined();
    });

    it('lightTheme uses vs monaco theme', () => {
      expect(lightTheme.monacoTheme).toBe('vs');
    });

    it('darkTheme uses vs-dark monaco theme', () => {
      expect(darkTheme.monacoTheme).toBe('vs-dark');
    });
  });


  describe('Theme Contrast', () => {
    // Expand shorthand hex (#fff -> #ffffff)
    function expandHex(hex: string): string {
      const cleanHex = hex.replace('#', '');
      if (cleanHex.length === 3) {
        return cleanHex.split('').map(c => c + c).join('');
      }
      return cleanHex;
    }

    function getLuminance(hex: string): number {
      const cleanHex = expandHex(hex);
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      
      const sRGB = [r, g, b].map(c => 
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      
      return 0.2126 * (sRGB[0] ?? 0) + 0.7152 * (sRGB[1] ?? 0) + 0.0722 * (sRGB[2] ?? 0);
    }

    function getContrastRatio(color1: string, color2: string): number {
      const l1 = getLuminance(color1);
      const l2 = getLuminance(color2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it('lightTheme text has sufficient contrast with background', () => {
      const ratio = getContrastRatio(lightTheme.text, lightTheme.background);
      // WCAG AA requires 4.5:1 for normal text
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('darkTheme text has sufficient contrast with background', () => {
      const ratio = getContrastRatio(darkTheme.text, darkTheme.background);
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('lightTheme primary has sufficient contrast with background', () => {
      const ratio = getContrastRatio(lightTheme.primary, lightTheme.background);
      // Primary buttons should have at least 3:1 contrast
      expect(ratio).toBeGreaterThan(3);
    });

    it('darkTheme primary has sufficient contrast with background', () => {
      const ratio = getContrastRatio(darkTheme.primary, darkTheme.background);
      expect(ratio).toBeGreaterThan(3);
    });
  });

  describe('Theme Type Safety', () => {
    it('lightTheme satisfies ThemeColors interface', () => {
      const theme: ThemeColors = lightTheme;
      expect(theme).toBeDefined();
    });

    it('darkTheme satisfies ThemeColors interface', () => {
      const theme: ThemeColors = darkTheme;
      expect(theme).toBeDefined();
    });

    it('monacoTheme is valid value', () => {
      expect(['vs', 'vs-dark']).toContain(lightTheme.monacoTheme);
      expect(['vs', 'vs-dark']).toContain(darkTheme.monacoTheme);
    });
  });
});
