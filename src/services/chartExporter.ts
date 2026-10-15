// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Chart Export Service
 * Exports D3 charts to PNG and SVG formats
 * Requirements: Chart export functionality
 */

/**
 * Export format options
 */
export type ExportFormat = 'png' | 'svg';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  scale?: number;  // For PNG export, scale factor (default 2 for retina)
  backgroundColor?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  error?: string;
}

/**
 * Export a chart SVG element to the specified format
 * @param svgElement - The SVG element to export
 * @param options - Export options
 */
export async function exportChart(
  svgElement: SVGSVGElement,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { format, filename = 'chart', scale = 2, backgroundColor } = options;
    
    if (format === 'svg') {
      return exportToSVG(svgElement, filename, backgroundColor);
    } else {
      return await exportToPNG(svgElement, filename, scale, backgroundColor);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Export SVG element to SVG file
 */
function exportToSVG(
  svgElement: SVGSVGElement,
  filename: string,
  backgroundColor?: string
): ExportResult {
  try {
    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Add background if specified
    if (backgroundColor) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', backgroundColor);
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    }
    
    // Add XML declaration and namespace
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n', svgData],
      { type: 'image/svg+xml;charset=utf-8' }
    );
    
    // Download the file
    downloadBlob(svgBlob, `${filename}.svg`);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SVG export failed',
    };
  }
}

/**
 * Export SVG element to PNG file
 */
async function exportToPNG(
  svgElement: SVGSVGElement,
  filename: string,
  scale: number,
  backgroundColor?: string
): Promise<ExportResult> {
  return new Promise((resolve) => {
    try {
      // Get SVG dimensions
      const bbox = svgElement.getBoundingClientRect();
      const width = bbox.width * scale;
      const height = bbox.height * scale;
      
      // Clone and prepare SVG
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('width', String(bbox.width));
      clonedSvg.setAttribute('height', String(bbox.height));
      
      // Add background if specified
      if (backgroundColor) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', backgroundColor);
        clonedSvg.insertBefore(rect, clonedSvg.firstChild);
      }
      
      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      
      // Create image and canvas
      const img = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve({ success: false, error: 'Failed to create canvas context' });
        return;
      }
      
      img.onload = () => {
        // Draw background
        if (backgroundColor) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }
        
        // Scale and draw image
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        // Convert to PNG and download
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `${filename}.png`);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: 'Failed to create PNG blob' });
          }
        }, 'image/png');
      };
      
      img.onerror = () => {
        resolve({ success: false, error: 'Failed to load SVG image' });
      };
      
      img.src = svgDataUrl;
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'PNG export failed',
      });
    }
  });
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get the SVG element from a chart container
 * @param container - The container element that holds the chart
 */
export function getChartSVG(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg');
}

/**
 * Generate a filename for chart export
 * @param chartType - The type of chart
 * @param timestamp - Whether to include timestamp
 */
export function generateExportFilename(
  chartType: string,
  timestamp: boolean = true
): string {
  const base = `chart-${chartType}`;
  if (timestamp) {
    const date = new Date();
    const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${base}-${ts}`;
  }
  return base;
}
