// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * Profile Charts Component - D3.js visualizations for OpenSearch query profiling
 */

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTheme } from '../../../../context/ThemeContext';
import type { ProfileData, ProfileComponent, PhaseTiming, ProfileBreakdown } from '../../../../types/profiling';
import { getShardTimings, getAllComponents } from '../../../../services/profileParser';

interface ChartProps {
  width?: number;
  height?: number;
  isDark?: boolean;
}

interface ShardChartProps extends ChartProps {
  profileData: ProfileData;
}

interface PhaseChartProps extends ChartProps {
  phaseTiming: PhaseTiming;
}

interface ComponentChartProps extends ChartProps {
  components: ProfileComponent[];
  maxItems?: number;
}

interface BreakdownChartProps extends ChartProps {
  breakdown: ProfileBreakdown[];
  title: string;
}

// Calming color palettes - soft, professional tones
const calmingPalettes = {
  // Soft blue-gray gradient for shards
  shards: ['#e8f4f8', '#b8d4e3', '#7eb3ce', '#4a93b8', '#2d7399'] as const,
  shardsDark: ['#1a3a4a', '#2d5a6f', '#4a7a94', '#6a9ab8', '#8abadc'] as const,
  // Soft teal gradient for phases
  phases: ['#e6f5f3', '#b3e0db', '#80cbc4', '#4db6ac', '#26a69a'] as const,
  phasesDark: ['#1a3d38', '#2d5a52', '#4a7a6f', '#6a9a8c', '#8abaa8'] as const,
  // Soft slate/purple gradient for components
  components: ['#eef0f5', '#c5cad9', '#9ba4bd', '#717ea1', '#4a5568'] as const,
  componentsDark: ['#2d3748', '#4a5568', '#718096', '#a0aec0', '#cbd5e0'] as const,
  // Soft warm gray for breakdowns
  breakdown: ['#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#525252'] as const,
  breakdownDark: ['#2d2d2d', '#4a4a4a', '#6a6a6a', '#8a8a8a', '#aaaaaa'] as const,
};

// Theme colors for text and axes
const themeColors = {
  light: {
    text: '#333',
    textSecondary: '#666',
    axis: '#333',
    axisLine: '#ccc',
  },
  dark: {
    text: '#e0e0e0',
    textSecondary: '#a0a0a0',
    axis: '#e0e0e0',
    axisLine: '#4a4a4a',
  },
};

// Create custom interpolators from our palettes
function createInterpolator(colors: readonly string[]) {
  return (t: number): string => {
    const safeT = Math.max(0, Math.min(1, t));
    const i = Math.min(Math.floor(safeT * (colors.length - 1)), colors.length - 2);
    const localT = (safeT * (colors.length - 1)) - i;
    const color1 = colors[i]!;
    const color2 = colors[i + 1]!;
    return d3.interpolateRgb(color1, color2)(localT);
  };
}

function getColorScales(isDark: boolean) {
  return {
    shards: d3.scaleSequential(createInterpolator(isDark ? calmingPalettes.shardsDark : calmingPalettes.shards)),
    phases: d3.scaleSequential(createInterpolator(isDark ? calmingPalettes.phasesDark : calmingPalettes.phases)),
    components: d3.scaleSequential(createInterpolator(isDark ? calmingPalettes.componentsDark : calmingPalettes.components)),
    breakdown: d3.scaleSequential(createInterpolator(isDark ? calmingPalettes.breakdownDark : calmingPalettes.breakdown)),
  };
}

/**
 * Horizontal bar chart for shard timings
 */
export function ShardTimingChart({ profileData, width = 450, height = 250, isDark = false }: ShardChartProps): React.ReactElement {
  const language = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    const shardTimings = getShardTimings(profileData).slice(0, 10);
    if (shardTimings.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 30, right: 80, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const maxTime = d3.max(shardTimings, d => d.timeMs) || 1;
    
    const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    const yScale = d3.scaleBand()
      .domain(shardTimings.map(d => d.name))
      .range([0, innerHeight])
      .padding(0.2);
    
    const colorScales = getColorScales(isDark);
    const colorScale = colorScales.shards.domain([0, maxTime]);
    
    // Bars
    g.selectAll('rect')
      .data(shardTimings)
      .join('rect')
      .attr('y', d => yScale(d.name) || 0)
      .attr('width', d => xScale(d.timeMs))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.timeMs))
      .attr('rx', 2);
    
    // Time labels on bars
    g.selectAll('.bar-label')
      .data(shardTimings)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => xScale(d.timeMs) + 6)
      .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', colors.text)
      .text(d => `${d.timeMs.toFixed(2)}ms`);
    
    // Y axis with tooltips for truncated labels
    const yAxis = g.append('g').call(d3.axisLeft(yScale));
    
    yAxis.selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', colors.axis)
      .style('cursor', 'default')
      .each(function() {
        const textEl = d3.select(this);
        const fullText = textEl.text();
        if (fullText.length > 15) {
          textEl.text(fullText.substring(0, 12) + '...');
        }
        // Always add title for tooltip
        textEl.append('title').text(fullText);
      });
    
    yAxis.selectAll('line').attr('stroke', colors.axisLine);
    yAxis.selectAll('path').attr('stroke', colors.axisLine);
    
    // X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5));
    
    xAxis.selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', colors.axis);
    xAxis.selectAll('line').attr('stroke', colors.axisLine);
    xAxis.selectAll('path').attr('stroke', colors.axisLine);
    
    // X axis label
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', colors.textSecondary)
      .text(t('Time (ms)'));
    
    // Title
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', colors.text)
      .text(t('Slowest Shards'));
      
  }, [profileData, width, height, isDark, colors, language]);
  
  return (
    <svg 
      ref={svgRef} 
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/**
 * Phase timing chart
 */
export function PhaseTimingChart({ phaseTiming, width = 400, height = 180, isDark = false }: PhaseChartProps): React.ReactElement {
  const language = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    const phases = [
      { name: t('Query'), time: phaseTiming.query },
      { name: t('Fetch'), time: phaseTiming.fetch },
      { name: t('DFS Query'), time: phaseTiming.dfsQuery },
      { name: t('DFS Pre-Query'), time: phaseTiming.dfsPreQuery },
      { name: t('Expand'), time: phaseTiming.expand },
      { name: t('Can Match'), time: phaseTiming.canMatch },
    ].filter(p => p.time > 0);
    
    if (phases.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 30, right: 70, bottom: 30, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const maxTime = d3.max(phases, d => d.time) || 1;
    
    const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    const yScale = d3.scaleBand()
      .domain(phases.map(d => d.name))
      .range([0, innerHeight])
      .padding(0.3);
    
    const colorScales = getColorScales(isDark);
    const colorScale = colorScales.phases.domain([0, maxTime]);
    
    // Bars
    g.selectAll('rect')
      .data(phases)
      .join('rect')
      .attr('y', d => yScale(d.name) || 0)
      .attr('width', d => xScale(d.time))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.time))
      .attr('rx', 2);
    
    // Time labels
    g.selectAll('.bar-label')
      .data(phases)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => xScale(d.time) + 6)
      .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', colors.text)
      .text(d => `${d.time}ms`);
    
    // Y axis
    const yAxis = g.append('g').call(d3.axisLeft(yScale));
    yAxis.selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', colors.axis);
    yAxis.selectAll('line').attr('stroke', colors.axisLine);
    yAxis.selectAll('path').attr('stroke', colors.axisLine);
    
    // Title
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', colors.text)
      .text(t('Query Phases'));
      
  }, [phaseTiming, width, height, isDark, colors, language]);
  
  return (
    <svg 
      ref={svgRef} 
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/**
 * Slowest components chart
 */
export function SlowestComponentsChart({ 
  components, 
  maxItems = 10, 
  width = 500, 
  height = 300,
  isDark = false,
}: ComponentChartProps): React.ReactElement {
  const language = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  useEffect(() => {
    if (!svgRef.current || components.length === 0) return;
    
    const topComponents = components.slice(0, maxItems);
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 30, right: 80, bottom: 30, left: 150 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const maxTime = d3.max(topComponents, d => d.timeMs) || 1;
    
    const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    const yScale = d3.scaleBand()
      .domain(topComponents.map(d => `${d.type}: ${d.name}`))
      .range([0, innerHeight])
      .padding(0.2);
    
    const colorScales = getColorScales(isDark);
    const colorScale = colorScales.components.domain([0, maxTime]);
    
    // Bars
    g.selectAll('rect')
      .data(topComponents)
      .join('rect')
      .attr('y', d => yScale(`${d.type}: ${d.name}`) || 0)
      .attr('width', d => xScale(d.timeMs))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.timeMs))
      .attr('rx', 2);
    
    // Time labels
    g.selectAll('.bar-label')
      .data(topComponents)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => xScale(d.timeMs) + 6)
      .attr('y', d => (yScale(`${d.type}: ${d.name}`) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', colors.text)
      .text(d => `${d.timeMs.toFixed(2)}ms`);
    
    // Y axis with tooltips for truncated labels
    const yAxis = g.append('g').call(d3.axisLeft(yScale));
    
    yAxis.selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', colors.axis)
      .style('cursor', 'default')
      .each(function() {
        const textEl = d3.select(this);
        const fullText = textEl.text();
        if (fullText.length > 20) {
          textEl.text(fullText.substring(0, 17) + '...');
        }
        // Always add title for tooltip
        textEl.append('title').text(fullText);
      });
    
    yAxis.selectAll('line').attr('stroke', colors.axisLine);
    yAxis.selectAll('path').attr('stroke', colors.axisLine);
    
    // Title
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', colors.text)
      .text(t('Slowest Components'));
      
  }, [components, maxItems, width, height, isDark, colors, language]);
  
  return (
    <svg 
      ref={svgRef} 
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/**
 * Breakdown chart for query/aggregation operations
 */
export function BreakdownChart({ 
  breakdown, 
  title, 
  width = 400, 
  height = 200,
  isDark = false,
}: BreakdownChartProps): React.ReactElement {
  const language = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  useEffect(() => {
    if (!svgRef.current || breakdown.length === 0) return;
    
    const topBreakdown = breakdown.filter(b => b.timeMs > 0).slice(0, 8);
    if (topBreakdown.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 30, right: 80, bottom: 20, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const maxTime = d3.max(topBreakdown, d => d.timeMs) || 1;
    
    const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    const yScale = d3.scaleBand()
      .domain(topBreakdown.map(d => formatOperationName(d.operation)))
      .range([0, innerHeight])
      .padding(0.25);
    
    const colorScales = getColorScales(isDark);
    const colorScale = colorScales.breakdown.domain([0, maxTime]);
    
    // Bars
    g.selectAll('rect')
      .data(topBreakdown)
      .join('rect')
      .attr('y', d => yScale(formatOperationName(d.operation)) || 0)
      .attr('width', d => xScale(d.timeMs))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.timeMs))
      .attr('rx', 2);
    
    // Time labels
    g.selectAll('.bar-label')
      .data(topBreakdown)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => xScale(d.timeMs) + 6)
      .attr('y', d => (yScale(formatOperationName(d.operation)) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '9px')
      .attr('fill', colors.text)
      .text(d => `${d.timeMs.toFixed(3)}ms`);
    
    // Y axis with tooltips for truncated labels
    const yAxis = g.append('g').call(d3.axisLeft(yScale));
    
    yAxis.selectAll('text')
      .attr('font-size', '9px')
      .attr('fill', colors.axis)
      .style('cursor', 'default')
      .each(function() {
        const textEl = d3.select(this);
        const fullText = textEl.text();
        if (fullText.length > 15) {
          textEl.text(fullText.substring(0, 12) + '...');
        }
        // Always add title for tooltip
        textEl.append('title').text(fullText);
      });
    
    yAxis.selectAll('line').attr('stroke', colors.axisLine);
    yAxis.selectAll('path').attr('stroke', colors.axisLine);
    
    // Title
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', colors.text)
      .text(t(title));
      
  }, [breakdown, title, width, height, isDark, colors, language]);
  
  return (
    <svg 
      ref={svgRef} 
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/**
 * Format operation name for display
 */
function formatOperationName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Main profile visualization component
 */
export function ProfileVisualization({ profileData }: { profileData: ProfileData }): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  
  const components = getAllComponents(profileData);
  const shardTimings = getShardTimings(profileData);
  
  // Check if we have any meaningful data to display (threshold of 0.001ms)
  const hasPhaseTiming = profileData.phaseTook && (
    profileData.phaseTook.query > 0 || 
    profileData.phaseTook.fetch > 0 ||
    profileData.phaseTook.dfsQuery > 0
  );
  // Only show shard data if there's meaningful timing (> 0.01ms)
  const meaningfulShardTimings = shardTimings.filter(s => s.timeMs > 0.01);
  const hasShardData = meaningfulShardTimings.length > 0;
  // Only show components with meaningful timing
  const meaningfulComponents = components.filter(c => c.timeMs > 0.01);
  const hasComponentData = meaningfulComponents.length > 0;
  
  if (!hasPhaseTiming && !hasShardData && !hasComponentData) {
    return (
      <div style={{ padding: '16px', color: isDark ? '#98a2b3' : '#666', textAlign: 'center' }}>{t('No profile data available. Make sure the query returned results.')}</div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px',
      padding: '16px',
      backgroundColor: isDark ? '#1e1e1e' : '#fafbfc',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
    }}>
      {/* Summary metrics */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        flexWrap: 'wrap',
        padding: '12px',
        backgroundColor: isDark ? '#252525' : '#fff',
        borderRadius: '4px',
        border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
      }}>
        {profileData.shards.length > 0 && (
          <MetricCard label="Total Shards" value={profileData.shards.length.toString()} isDark={isDark} />
        )}
        <MetricCard label="Total Time" value={`${profileData.totalTimeMs.toFixed(2)}ms`} isDark={isDark} />
        {profileData.phaseTook && (
          <>
            {profileData.phaseTook.query > 0 && (
              <MetricCard label="Query Phase" value={`${profileData.phaseTook.query}ms`} isDark={isDark} />
            )}
            {profileData.phaseTook.fetch > 0 && (
              <MetricCard label="Fetch Phase" value={`${profileData.phaseTook.fetch}ms`} isDark={isDark} />
            )}
          </>
        )}
      </div>
      
      {/* All charts in a consistent grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '16px',
      }}>
        {/* Phase timing chart */}
        {hasPhaseTiming && (
          <div style={{ 
            backgroundColor: isDark ? '#252525' : '#fff', 
            borderRadius: '4px', 
            border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
            padding: '12px',
            minHeight: '220px',
          }}>
            <PhaseTimingChart phaseTiming={profileData.phaseTook!} width={450} height={200} isDark={isDark} />
          </div>
        )}
        
        {/* Shard timing chart - only show if there's meaningful data */}
        {hasShardData && (
          <div style={{ 
            backgroundColor: isDark ? '#252525' : '#fff', 
            borderRadius: '4px', 
            border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
            padding: '12px',
            minHeight: '220px',
          }}>
            <ShardTimingChart profileData={profileData} width={450} height={200} isDark={isDark} />
          </div>
        )}
        
        {/* Slowest components - only show if there's meaningful data */}
        {hasComponentData && (
          <div style={{ 
            backgroundColor: isDark ? '#252525' : '#fff', 
            borderRadius: '4px', 
            border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
            padding: '12px',
            minHeight: '220px',
          }}>
            <SlowestComponentsChart components={meaningfulComponents} width={450} height={200} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Metric card component
 */
function MetricCard({ label, value, isDark = false }: { label: string; value: string; isDark?: boolean }): React.ReactElement {
  useLanguage();
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: isDark ? '#98a2b3' : '#666', marginBottom: '4px' }}>{t(label)}</div>
      <div style={{ fontSize: '18px', fontWeight: '600', color: isDark ? '#e0e0e0' : '#333' }}>{value}</div>
    </div>
  );
}

export default ProfileVisualization;
