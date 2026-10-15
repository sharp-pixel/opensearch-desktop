// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * PieChart component using D3
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { PieDataPoint, PieChartConfig, ChartColorPalette } from '../../../../types/chart';

interface PieChartProps {
  data: PieDataPoint[];
  config: PieChartConfig;
  palette: ChartColorPalette;
  width: number;
  height: number;
}

export function PieChart({
  data,
  config,
  palette,
  width,
  height,
}: PieChartProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: config.showLegend ? 150 : 20, bottom: 20, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left + chartWidth / 2}, ${margin.top + chartHeight / 2})`);

    // Create pie generator
    const pie = d3.pie<PieDataPoint>()
      .value(d => d.value)
      .sort(null);

    // Create arc generator
    const arc = d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    // Create hover arc (slightly larger)
    const hoverArc = d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius * 1.05);

    // Draw slices
    g.selectAll('.slice')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr('d', d => arc(d) ?? '')
      .attr('fill', d => d.data.color)
      .attr('stroke', palette.background)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', hoverArc(d) ?? '');
        
        const content = config.showPercentages
          ? `${d.data.label}: ${d.data.value.toLocaleString()} (${d.data.percentage.toFixed(1)}%)`
          : `${d.data.label}: ${d.data.value.toLocaleString()}`;
        
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content,
        });
      })
      .on('mousemove', function(event) {
        setTooltip(prev => ({
          ...prev,
          x: event.pageX,
          y: event.pageY,
        }));
      })
      .on('mouseleave', function(_, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc(d) ?? '');
        
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // Add percentage labels on slices (for larger slices)
    if (config.showPercentages) {
      const labelArc = d3.arc<d3.PieArcDatum<PieDataPoint>>()
        .innerRadius(radius * 0.6)
        .outerRadius(radius * 0.6);

      g.selectAll('.label')
        .data(pie(data).filter(d => d.data.percentage > 5)) // Only show labels for slices > 5%
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', '#fff')
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .text(d => `${d.data.percentage.toFixed(0)}%`);
    }

    // Add legend
    if (config.showLegend) {
      const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

      const legendItems = legend.selectAll('.legend-item')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (_d, i) => `translate(0, ${i * 20})`);

      legendItems.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('fill', d => d.color);

      legendItems.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('fill', palette.text)
        .attr('font-size', '11px')
        .text(d => {
          const label = d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label;
          return config.showPercentages ? `${label} (${d.percentage.toFixed(1)}%)` : label;
        });
    }

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

export default PieChart;
