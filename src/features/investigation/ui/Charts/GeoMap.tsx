// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * GeoMap component using D3 for geographic data visualization
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { GeoDataPoint, GeoMapConfig, ChartColorPalette } from '../../../../types/chart';

interface GeoMapProps {
  data: GeoDataPoint[];
  config: GeoMapConfig;
  palette: ChartColorPalette;
  width: number;
  height: number;
}

// Simple world map outline (simplified GeoJSON)
const WORLD_OUTLINE = {
  type: 'Sphere' as const,
};

export function GeoMap({
  data,
  config,
  palette,
  width,
  height,
}: GeoMapProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create projection
    const projection = d3.geoMercator()
      .scale(chartWidth / 6)
      .center([0, 20])
      .translate([chartWidth / 2, chartHeight / 2]);

    // Create path generator
    const path = d3.geoPath().projection(projection);

    // Main group for zoom/pan
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Background
    g.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', getMapBackground(palette))
      .attr('rx', 4);

    // Draw world outline (sphere)
    g.append('path')
      .datum(WORLD_OUTLINE)
      .attr('d', path as unknown as string)
      .attr('fill', 'none')
      .attr('stroke', palette.grid)
      .attr('stroke-width', 1);

    // Draw graticule (grid lines)
    const graticule = d3.geoGraticule();
    g.append('path')
      .datum(graticule())
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', palette.grid)
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.3);

    // Calculate marker sizes
    const values = data.map(d => d.value || 1);
    const minValue = d3.min(values) || 1;
    const maxValue = d3.max(values) || 1;
    
    const sizeScale = config.markerSize === 'scaled'
      ? d3.scaleSqrt().domain([minValue, maxValue]).range([4, 20])
      : () => 6;

    // Get unique clusters for legend
    const clusters = config.colorByCluster 
      ? [...new Set(data.filter(d => d.cluster).map(d => d.cluster!))]
      : [];

    // Draw markers
    const markers = g.selectAll('.marker')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'marker')
      .attr('cx', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[0] : 0;
      })
      .attr('cy', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[1] : 0;
      })
      .attr('r', d => sizeScale(d.value || 1))
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.7)
      .attr('stroke', palette.background)
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('fill-opacity', 1)
          .attr('stroke-width', 2);
        
        let content = d.label;
        if (d.value !== undefined) {
          content += ` (${d.value.toLocaleString()})`;
        }
        if (d.cluster) {
          content += ` [${d.cluster}]`;
        }
        
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content,
        });
      })
      .on('mousemove', function(event) {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on('mouseleave', function() {
        d3.select(this)
          .attr('fill-opacity', 0.7)
          .attr('stroke-width', 1);
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', `translate(${margin.left}, ${margin.top}) ${event.transform}`);
        
        // Adjust marker sizes on zoom
        markers.attr('r', d => sizeScale(d.value || 1) / Math.sqrt(event.transform.k));
      });

    svg.call(zoom);

    // Add legend for clusters
    if (config.colorByCluster && clusters.length > 0) {
      const legend = svg.append('g')
        .attr('transform', `translate(${width - 110}, 20)`);

      legend.append('rect')
        .attr('x', -10)
        .attr('y', -10)
        .attr('width', 100)
        .attr('height', clusters.length * 20 + 20)
        .attr('fill', palette.background)
        .attr('fill-opacity', 0.9)
        .attr('stroke', palette.border)
        .attr('rx', 4);

      clusters.forEach((cluster, i) => {
        const color = data.find(d => d.cluster === cluster)?.color || palette.primary[i] || '#3b82f6';
        
        const item = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`);

        item.append('circle')
          .attr('cx', 6)
          .attr('cy', 6)
          .attr('r', 5)
          .attr('fill', color);

        item.append('text')
          .attr('x', 18)
          .attr('y', 10)
          .attr('fill', palette.text)
          .attr('font-size', '10px')
          .text(cluster.length > 10 ? cluster.substring(0, 10) + '...' : cluster);
      });
    }

    // Add zoom controls
    const controls = svg.append('g')
      .attr('transform', `translate(20, ${height - 70})`);

    // Zoom in button
    controls.append('rect')
      .attr('width', 24)
      .attr('height', 24)
      .attr('fill', palette.surface)
      .attr('stroke', palette.border)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5);
      });

    controls.append('text')
      .attr('x', 12)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', palette.text)
      .attr('font-size', '16px')
      .attr('pointer-events', 'none')
      .text('+');

    // Zoom out button
    controls.append('rect')
      .attr('y', 28)
      .attr('width', 24)
      .attr('height', 24)
      .attr('fill', palette.surface)
      .attr('stroke', palette.border)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.67);
      });

    controls.append('text')
      .attr('x', 12)
      .attr('y', 44)
      .attr('text-anchor', 'middle')
      .attr('fill', palette.text)
      .attr('font-size', '16px')
      .attr('pointer-events', 'none')
      .text('−');

  }, [data, config, palette, width, height]);

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: tooltip.x + 10,
    top: tooltip.y - 10,
    backgroundColor: palette.tooltip.background,
    color: palette.tooltip.text,
    border: `1px solid ${palette.tooltip.border}`,
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    pointerEvents: 'none',
    zIndex: 1000,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    display: tooltip.visible ? 'block' : 'none',
    maxWidth: '300px',
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ backgroundColor: palette.background }}
      />
      <div style={tooltipStyle}>{tooltip.content}</div>
    </div>
  );
}

function getMapBackground(palette: ChartColorPalette): string {
  // Determine if dark mode based on background color
  const isDark = palette.background.startsWith('#1') || palette.background.startsWith('#2');
  return isDark ? '#1a2744' : '#e6f0fa';
}

export default GeoMap;
