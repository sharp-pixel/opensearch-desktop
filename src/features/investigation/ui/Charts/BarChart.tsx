// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * BarChart component using D3
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { BarDataPoint, BarChartConfig, ChartColorPalette } from '../../../../types/chart';

interface BarChartProps {
  data: BarDataPoint[];
  config: BarChartConfig;
  palette: ChartColorPalette;
  width: number;
  height: number;
}

export function BarChart({
  data,
  config,
  palette,
  width,
  height,
}: BarChartProps): React.ReactElement {
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

    const margin = { 
      top: 20, 
      right: config.showLegend && config.groupByCluster ? 120 : 20, 
      bottom: 50, 
      left: 60 
    };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Get unique categories and clusters
    const categories = [...new Set(data.map(d => d.category))];
    const clusters = config.groupByCluster 
      ? [...new Set(data.filter(d => d.cluster).map(d => d.cluster!))]
      : [];

    if (config.orientation === 'vertical') {
      renderVerticalBars(g, data, categories, clusters, chartWidth, chartHeight, config, palette, setTooltip);
    } else {
      renderHorizontalBars(g, data, categories, clusters, chartWidth, chartHeight, config, palette, setTooltip);
    }

    // Add legend for grouped bars
    if (config.showLegend && config.groupByCluster && clusters.length > 0) {
      const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);

      clusters.forEach((cluster, i) => {
        const color = data.find(d => d.cluster === cluster)?.color || palette.primary[i] || '#3b82f6';
        
        const item = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`);

        item.append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('rx', 2)
          .attr('fill', color);

        item.append('text')
          .attr('x', 18)
          .attr('y', 10)
          .attr('fill', palette.text)
          .attr('font-size', '11px')
          .text(cluster.length > 12 ? cluster.substring(0, 12) + '...' : cluster);
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

function renderVerticalBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: BarDataPoint[],
  categories: string[],
  clusters: string[],
  chartWidth: number,
  chartHeight: number,
  config: BarChartConfig,
  palette: ChartColorPalette,
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; content: string }>>
) {
  // X scale for categories
  const x0 = d3.scaleBand()
    .domain(categories)
    .range([0, chartWidth])
    .padding(0.2);

  // X scale for clusters within each category (for grouped bars)
  const x1 = d3.scaleBand()
    .domain(clusters.length > 0 ? clusters : ['default'])
    .range([0, x0.bandwidth()])
    .padding(0.05);

  // Y scale
  const maxValue = d3.max(data, d => d.value) || 0;
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([chartHeight, 0]);

  // X axis
  g.append('g')
    .attr('transform', `translate(0, ${chartHeight})`)
    .call(d3.axisBottom(x0))
    .selectAll('text')
    .attr('fill', palette.text)
    .attr('font-size', '10px')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end');

  g.selectAll('.domain, .tick line')
    .attr('stroke', palette.axis);

  // Y axis
  g.append('g')
    .call(d3.axisLeft(y).ticks(5))
    .selectAll('text')
    .attr('fill', palette.text)
    .attr('font-size', '10px');

  g.selectAll('.domain, .tick line')
    .attr('stroke', palette.axis);

  // Grid lines
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-chartWidth).tickFormat(() => ''))
    .selectAll('line')
    .attr('stroke', palette.grid)
    .attr('stroke-opacity', 0.5);

  g.select('.grid .domain').remove();

  // Draw bars
  if (config.groupByCluster && clusters.length > 0) {
    // Grouped bars
    categories.forEach(category => {
      const categoryData = data.filter(d => d.category === category);
      
      g.selectAll(`.bar-${category.replace(/\s/g, '-')}`)
        .data(categoryData)
        .enter()
        .append('rect')
        .attr('x', d => (x0(category) || 0) + (x1(d.cluster || 'default') || 0))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => chartHeight - y(d.value))
        .attr('fill', d => d.color)
        .attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const content = d.cluster 
            ? `${d.category} (${d.cluster}): ${d.value.toLocaleString()}`
            : `${d.category}: ${d.value.toLocaleString()}`;
          setTooltip({ visible: true, x: event.pageX, y: event.pageY, content });
        })
        .on('mousemove', function(event) {
          setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 1);
          setTooltip(prev => ({ ...prev, visible: false }));
        });
    });
  } else {
    // Simple bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x0(d.category) || 0)
      .attr('y', d => y(d.value))
      .attr('width', x0.bandwidth())
      .attr('height', d => chartHeight - y(d.value))
      .attr('fill', d => d.color)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `${d.category}: ${d.value.toLocaleString()}`,
        });
      })
      .on('mousemove', function(event) {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1);
        setTooltip(prev => ({ ...prev, visible: false }));
      });
  }
}

function renderHorizontalBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: BarDataPoint[],
  categories: string[],
  clusters: string[],
  chartWidth: number,
  chartHeight: number,
  config: BarChartConfig,
  palette: ChartColorPalette,
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; content: string }>>
) {
  // Y scale for categories
  const y0 = d3.scaleBand()
    .domain(categories)
    .range([0, chartHeight])
    .padding(0.2);

  // Y scale for clusters within each category
  const y1 = d3.scaleBand()
    .domain(clusters.length > 0 ? clusters : ['default'])
    .range([0, y0.bandwidth()])
    .padding(0.05);

  // X scale
  const maxValue = d3.max(data, d => d.value) || 0;
  const x = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([0, chartWidth]);

  // Y axis
  g.append('g')
    .call(d3.axisLeft(y0))
    .selectAll('text')
    .attr('fill', palette.text)
    .attr('font-size', '10px');

  g.selectAll('.domain, .tick line')
    .attr('stroke', palette.axis);

  // X axis
  g.append('g')
    .attr('transform', `translate(0, ${chartHeight})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll('text')
    .attr('fill', palette.text)
    .attr('font-size', '10px');

  // Grid lines
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisBottom(x).ticks(5).tickSize(chartHeight).tickFormat(() => ''))
    .selectAll('line')
    .attr('stroke', palette.grid)
    .attr('stroke-opacity', 0.5);

  g.select('.grid .domain').remove();

  // Draw bars
  if (config.groupByCluster && clusters.length > 0) {
    categories.forEach(category => {
      const categoryData = data.filter(d => d.category === category);
      
      g.selectAll(`.bar-${category.replace(/\s/g, '-')}`)
        .data(categoryData)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', d => (y0(category) || 0) + (y1(d.cluster || 'default') || 0))
        .attr('width', d => x(d.value))
        .attr('height', y1.bandwidth())
        .attr('fill', d => d.color)
        .attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const content = d.cluster 
            ? `${d.category} (${d.cluster}): ${d.value.toLocaleString()}`
            : `${d.category}: ${d.value.toLocaleString()}`;
          setTooltip({ visible: true, x: event.pageX, y: event.pageY, content });
        })
        .on('mousemove', function(event) {
          setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 1);
          setTooltip(prev => ({ ...prev, visible: false }));
        });
    });
  } else {
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => y0(d.category) || 0)
      .attr('width', d => x(d.value))
      .attr('height', y0.bandwidth())
      .attr('fill', d => d.color)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `${d.category}: ${d.value.toLocaleString()}`,
        });
      })
      .on('mousemove', function(event) {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1);
        setTooltip(prev => ({ ...prev, visible: false }));
      });
  }
}

export default BarChart;
