// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../../i18n';
/**
 * Histogram component using D3 for time-series data with zoom support
 * Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.8
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { HistogramBucket, HistogramConfig, ChartColorPalette } from '../../../../types/chart';

interface HistogramProps {
  data: HistogramBucket[];
  config: HistogramConfig;
  palette: ChartColorPalette;
  width: number;
  height: number;
}

interface ZoomState {
  startTime: Date;
  endTime: Date;
}

export function Histogram({
  data,
  config,
  palette,
  width,
  height,
}: HistogramProps): React.ReactElement {
  useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });
  
  // Zoom state - null means showing full data range
  const [zoomState, setZoomState] = useState<ZoomState | null>(null);

  // Reset zoom when data changes significantly
  useEffect(() => {
    setZoomState(null);
  }, [data.length]);

  const handleResetZoom = useCallback(() => {
    setZoomState(null);
  }, []);

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

    // Filter data based on zoom state
    const filteredData = zoomState
      ? data.filter(d => d.startTime >= zoomState.startTime && d.endTime <= zoomState.endTime)
      : data;

    if (filteredData.length === 0) {
      // If zoom resulted in no data, reset
      setZoomState(null);
      return;
    }

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Get time extent from filtered data
    const timeExtent = d3.extent(filteredData, d => d.startTime) as [Date, Date];
    const maxEndTime = d3.max(filteredData, d => d.endTime) as Date;

    // X scale (time)
    const x = d3.scaleTime()
      .domain([timeExtent[0], maxEndTime])
      .range([0, chartWidth]);

    // Get unique clusters
    const clusters = config.groupByCluster 
      ? [...new Set(filteredData.filter(d => d.cluster).map(d => d.cluster!))]
      : [];

    // Y scale
    let maxValue: number;
    if (config.stacked && clusters.length > 0) {
      const bucketSums = new Map<string, number>();
      filteredData.forEach(d => {
        const key = d.startTime.toISOString();
        bucketSums.set(key, (bucketSums.get(key) || 0) + d.value);
      });
      maxValue = d3.max(Array.from(bucketSums.values())) || 0;
    } else {
      maxValue = d3.max(filteredData, d => d.value) || 0;
    }

    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([chartHeight, 0]);

    // X axis with time formatting
    const xAxis = d3.axisBottom(x)
      .ticks(6)
      .tickFormat(d => formatTimeLabel(d as Date, config.interval));

    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
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

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-chartWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', palette.grid)
      .attr('stroke-opacity', 0.5);

    g.select('.grid .domain').remove();

    // Calculate bar width based on data
    const firstBucket = filteredData[0];
    const barWidth = firstBucket 
      ? Math.max(1, (x(firstBucket.endTime) - x(firstBucket.startTime)) - 2)
      : 10;

    if (config.groupByCluster && clusters.length > 0) {
      if (config.stacked) {
        renderStackedBars(g, filteredData, clusters, x, y, chartHeight, barWidth, palette, setTooltip, config);
      } else {
        renderOverlaidLines(g, filteredData, clusters, x, y, palette, setTooltip, config);
      }
    } else {
      // Simple bars
      g.selectAll('.bar')
        .data(filteredData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.startTime))
        .attr('y', d => y(d.value))
        .attr('width', barWidth)
        .attr('height', d => chartHeight - y(d.value))
        .attr('fill', d => d.color)
        .attr('rx', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          setTooltip({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            content: `${formatTimeRange(d.startTime, d.endTime, config.interval)}: ${d.value.toLocaleString()}`,
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

    // Add brush for zoom selection
    const brush = d3.brushX<unknown>()
      .extent([[0, 0], [chartWidth, chartHeight]])
      .on('end', (event) => {
        if (!event.selection) return;
        
        const [x0, x1] = event.selection as [number, number];
        const newStartTime = x.invert(x0);
        const newEndTime = x.invert(x1);
        
        // Only zoom if selection is meaningful (at least 2 data points)
        const selectedData = filteredData.filter(
          d => d.startTime >= newStartTime && d.endTime <= newEndTime
        );
        
        if (selectedData.length >= 2) {
          setZoomState({
            startTime: newStartTime,
            endTime: newEndTime,
          });
        }
        
        // Clear the brush selection
        (g.select('.brush') as d3.Selection<SVGGElement, unknown, null, undefined>).call(brush.move, null);
      });

    // Add brush to chart
    g.append('g')
      .attr('class', 'brush')
      .call(brush)
      .selectAll('rect')
      .attr('rx', 2);

    // Style the brush selection
    g.select('.brush .selection')
      .attr('fill', palette.primary[0] || '#3b82f6')
      .attr('fill-opacity', 0.2)
      .attr('stroke', palette.primary[0] || '#3b82f6')
      .attr('stroke-width', 1);

    // Add legend
    if (config.showLegend && config.groupByCluster && clusters.length > 0) {
      const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);

      clusters.forEach((cluster, i) => {
        const color = filteredData.find(d => d.cluster === cluster)?.color || palette.primary[i] || '#3b82f6';
        
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

  }, [data, config, palette, width, height, zoomState]);

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

  const resetButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: config.showLegend && config.groupByCluster ? '130px' : '8px',
    padding: '4px 10px',
    backgroundColor: palette.surface,
    border: `1px solid ${palette.border}`,
    borderRadius: '4px',
    fontSize: '11px',
    color: palette.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    zIndex: 10,
  };

  const hintStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '4px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '10px',
    color: palette.text,
    opacity: 0.5,
    pointerEvents: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ backgroundColor: palette.background }}
      />
      
      {/* Reset zoom button - only show when zoomed */}
      {zoomState && (
        <button
          onClick={handleResetZoom}
          style={resetButtonStyle}
          title={t('Reset to full time range')}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>{t('Reset Zoom')}</button>
      )}
      
      {/* Hint text when not zoomed */}
      {!zoomState && data.length > 2 && (
        <div style={hintStyle}>{t('Drag to select a time range to zoom')}</div>
      )}
      
      <div style={tooltipStyle}>{tooltip.content}</div>
    </div>
  );
}

function renderStackedBars(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: HistogramBucket[],
  _clusters: string[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleLinear<number, number>,
  chartHeight: number,
  barWidth: number,
  _palette: ChartColorPalette,
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; content: string }>>,
  config: HistogramConfig
) {
  // Group data by time bucket
  const bucketMap = new Map<string, HistogramBucket[]>();
  data.forEach(d => {
    const key = d.startTime.toISOString();
    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
    }
    bucketMap.get(key)!.push(d);
  });

  // Draw stacked bars
  bucketMap.forEach((buckets) => {
    let yOffset = chartHeight;
    
    buckets.forEach(bucket => {
      const barHeight = chartHeight - y(bucket.value);
      yOffset -= barHeight;
      
      g.append('rect')
        .attr('x', x(bucket.startTime))
        .attr('y', yOffset)
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('fill', bucket.color)
        .attr('rx', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event) {
          d3.select(this).attr('opacity', 0.8);
          setTooltip({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            content: `${bucket.cluster}: ${formatTimeRange(bucket.startTime, bucket.endTime, config.interval)} - ${bucket.value.toLocaleString()}`,
          });
        })
        .on('mousemove', function(event) {
          setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 1);
          setTooltip(prev => ({ ...prev, visible: false }));
        });
    });
  });
}

function renderOverlaidLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: HistogramBucket[],
  clusters: string[],
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleLinear<number, number>,
  palette: ChartColorPalette,
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; content: string }>>,
  config: HistogramConfig
) {
  // Draw line for each cluster
  clusters.forEach(cluster => {
    const clusterData = data
      .filter(d => d.cluster === cluster)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (clusterData.length === 0) return;

    const color = clusterData[0]?.color ?? '#3b82f6';

    // Draw line
    const line = d3.line<HistogramBucket>()
      .x(d => x(d.startTime) + (x(d.endTime) - x(d.startTime)) / 2)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(clusterData)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw points
    g.selectAll(`.point-${cluster.replace(/\s/g, '-')}`)
      .data(clusterData)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.startTime) + (x(d.endTime) - x(d.startTime)) / 2)
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', color)
      .attr('stroke', palette.background)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('r', 6);
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `${cluster}: ${formatTimeRange(d.startTime, d.endTime, config.interval)} - ${d.value.toLocaleString()}`,
        });
      })
      .on('mousemove', function(event) {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on('mouseleave', function() {
        d3.select(this).attr('r', 4);
        setTooltip(prev => ({ ...prev, visible: false }));
      });
  });
}

function formatTimeLabel(date: Date, interval: HistogramConfig['interval']): string {
  switch (interval) {
    case 'minute':
      return d3.timeFormat('%H:%M')(date);
    case 'hour':
      return d3.timeFormat('%m/%d %H:00')(date);
    case 'day':
      return d3.timeFormat('%m/%d')(date);
    case 'week':
      return d3.timeFormat('%m/%d')(date);
    case 'month':
      return d3.timeFormat('%Y-%m')(date);
    default:
      return d3.timeFormat('%m/%d %H:%M')(date);
  }
}

function formatTimeRange(start: Date, _end: Date, interval: HistogramConfig['interval']): string {
  const format = formatTimeLabel(start, interval);
  return format;
}

export default Histogram;
