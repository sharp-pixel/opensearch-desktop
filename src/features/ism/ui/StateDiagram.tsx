// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../i18n';
/**
 * State Diagram Component
 * D3-based visualization of ISM policy state machine
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '../../../context/ThemeContext';
import type { DiagramData, DiagramNode, DiagramEdge } from '../../../types/ism';
import { getStateColor, formatConditionLabel, formatActionDisplay } from '../domain/ismDiagramGenerator';

type LayoutDirection = 'horizontal' | 'vertical';
type LayoutChoice = LayoutDirection | 'auto';

interface StateDiagramProps {
  data: DiagramData | null;
  onStateClick: (stateName: string) => void;
  selectedState?: string | null;
}

interface NodePosition {
  x: number;
  y: number;
  node: DiagramNode;
}

interface EdgePosition {
  source: NodePosition;
  target: NodePosition;
  edge: DiagramEdge;
}

export function StateDiagram({
  data,
  onStateClick,
  selectedState,
}: StateDiagramProps): React.ReactElement {
  const language = useLanguage();
  const { theme, mode } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutChoice, setLayout] = useState<LayoutChoice>('auto');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const count = data?.nodes.length ?? 0;
  const horizontalFit = Math.min((size.width - 96) / Math.max(120, (count - 1) * 200 + 120), (size.height - 96) / 100);
  const verticalFit = Math.min((size.width - 96) / 260, (size.height - 96) / Math.max(60, (count - 1) * 140 + 60));
  const layout: LayoutDirection = layoutChoice === 'auto' ? (verticalFit > horizontalFit ? 'vertical' : 'horizontal') : layoutChoice;
  const selectedNode = data?.nodes.find(node => node.id === selectedState) || data?.nodes.find(node => node.isDefault) || data?.nodes[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [data]);

  const changeZoom = (factor: number) => {
    if (svgRef.current && zoomRef.current) d3.select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };

  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: theme.background,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  };

  const emptyStateStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.textMuted,
    fontSize: '14px',
  };

  const toolbarStyles: React.CSSProperties = {
    flexShrink: 0,
    flexWrap: 'wrap',
    margin: '8px',
    display: 'flex',
    gap: '4px',
    zIndex: 10,
    backgroundColor: theme.surface,
    padding: '4px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: `1px solid ${theme.border}`,
  };

  const layoutButtonStyles = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    padding: '4px 8px',
    height: '28px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: active ? theme.primaryLight : 'transparent',
    color: active ? theme.primary : theme.textMuted,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || !size.width || !size.height) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = size;

    svg.attr('width', width).attr('height', height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g');

    // Calculate node positions based on layout direction
    const nodePositions = calculatePositions(data.nodes, width, height, data.edges, layout);
    const edgePositions = calculateEdgePositions(data.edges, nodePositions);

    // Define arrow marker with better visibility
    const defs = svg.append('defs');
    
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-4 L 10,0 L 0,4 Z')
      .attr('fill', theme.primary);

    // Draw edges first (so they appear behind nodes)
    const edges = g.selectAll('.edge')
      .data(edgePositions)
      .enter()
      .append('g')
      .attr('class', 'edge');

    // Draw edge paths with arrows
    edges.append('path')
      .attr('d', (d) => {
        // Check if this is a self-loop
        if (d.source.node.id === d.target.node.id) {
          const loopSize = 40;
          if (layout === 'horizontal') {
            return `M ${d.source.x} ${d.source.y - 35} 
                    C ${d.source.x - loopSize} ${d.source.y - 70}, 
                      ${d.source.x + loopSize} ${d.source.y - 70}, 
                      ${d.source.x} ${d.source.y - 35}`;
          } else {
            return `M ${d.source.x + 65} ${d.source.y} 
                    C ${d.source.x + 100} ${d.source.y - loopSize}, 
                      ${d.source.x + 100} ${d.source.y + loopSize}, 
                      ${d.source.x + 65} ${d.source.y}`;
          }
        }
        
        // Calculate the direction vector
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return '';
        
        // Node dimensions
        const nodeWidth = 65;
        const nodeHeight = 35;
        
        // Calculate offset based on direction
        let offsetX: number, offsetY: number;
        if (layout === 'horizontal') {
          offsetX = nodeWidth * Math.sign(dx);
          offsetY = 0;
        } else {
          offsetX = 0;
          offsetY = nodeHeight * Math.sign(dy);
        }
        
        // Adjusted start and end points
        const startX = d.source.x + offsetX;
        const startY = d.source.y + offsetY;
        const endX = d.target.x - offsetX;
        const endY = d.target.y - offsetY;
        
        // Calculate midpoint for label positioning
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        // Control point offset for curve
        const curveOffset = layout === 'horizontal' ? -25 : 25;
        const ctrlX = layout === 'horizontal' ? midX : midX + curveOffset;
        const ctrlY = layout === 'horizontal' ? midY + curveOffset : midY;
        
        return `M ${startX},${startY} Q ${ctrlX},${ctrlY} ${endX},${endY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', theme.primary)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Draw edge labels with better positioning
    edges.each(function(d) {
      const edgeGroup = d3.select(this);
      
      // Skip self-loops for label positioning
      if (d.source.node.id === d.target.node.id) return;
      
      // Calculate label position at midpoint of the curve
      const midX = (d.source.x + d.target.x) / 2;
      const midY = (d.source.y + d.target.y) / 2;
      
      // Offset label away from the line
      const labelOffset = layout === 'horizontal' ? -35 : 35;
      const labelX = layout === 'horizontal' ? midX : midX + labelOffset;
      const labelY = layout === 'horizontal' ? midY + labelOffset : midY;
      
      const labelText = d.edge.hasConditions 
        ? formatConditionLabel(d.edge.conditions.reduce((acc, c) => ({ ...acc, [c.type]: c.value }), {}))
        : 'immediate';
      
      // Create a temporary text element to measure the text width
      const tempText = edgeGroup.append('text')
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .text(labelText);
      const textBBox = (tempText.node() as SVGTextElement)?.getBBox();
      tempText.remove();
      
      // Add background rectangle with padding
      if (textBBox) {
        const padding = { x: 8, y: 4 };
        edgeGroup.append('rect')
          .attr('x', labelX - textBBox.width / 2 - padding.x)
          .attr('y', labelY - textBBox.height / 2 - padding.y)
          .attr('width', textBBox.width + padding.x * 2)
          .attr('height', textBBox.height + padding.y * 2)
          .attr('rx', 4)
          .attr('fill', theme.surface)
          .attr('stroke', theme.border)
          .attr('stroke-width', 1);
      }
      
      // Add the label text
      edgeGroup.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', theme.text)
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .text(labelText);
    });

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(nodePositions)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => t('View state {name}', { name: d.node.name }))
      .on('click', (_, d) => onStateClick(d.node.id))
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); onStateClick(d.node.id);
        }
      });
    nodes.append('title').text(d => `${d.node.name}: ${d.node.actions.map(formatActionDisplay).join(', ') || t('No actions')}`);

    // Node shadow for depth
    nodes.append('rect')
      .attr('x', -58)
      .attr('y', -28)
      .attr('width', 120)
      .attr('height', 60)
      .attr('rx', 8)
      .attr('fill', 'rgba(0,0,0,0.05)')
      .attr('filter', 'blur(4px)');

    // Node background
    nodes.append('rect').attr('class', 'node-background')
      .attr('x', -60)
      .attr('y', -30)
      .attr('width', 120)
      .attr('height', 60)
      .attr('rx', 8)
      .attr('fill', theme.surface)
      .attr('stroke', (d) => getStateColor(d.node.stateType))
      .attr('stroke-width', 2);

    // Default state indicator (blue dot)
    nodes.filter((d) => d.node.isDefault)
      .append('circle')
      .attr('cx', -50)
      .attr('cy', -20)
      .attr('r', 6)
      .attr('fill', getStateColor('default'));

    // Terminal state indicator (red square)
    nodes.filter((d) => d.node.isTerminal)
      .append('rect')
      .attr('x', 40)
      .attr('y', -26)
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 2)
      .attr('fill', getStateColor('terminal'));

    // Node title
    nodes.append('text')
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.text)
      .attr('font-size', '13px')
      .attr('font-weight', 600)
      .text((d) => d.node.name);

    // Keep the overview concise; complete action parameters are in the detail panel.
    nodes.append('text')
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.textMuted)
      .attr('font-size', '12px')
      .text(d => t(d.node.actions.length === 1 ? '{count} action' : '{count} actions', { count: d.node.actions.length }));

    const bounds = g.node()?.getBBox();
    if (bounds) {
      const fitScale = Math.min(Math.max(1, width - 64) / Math.max(bounds.width, 1), Math.max(1, height - 64) / Math.max(bounds.height, 1), 1);
      zoom.scaleExtent([Math.min(0.3, fitScale), 3]);
      const center = (scale: number) => {
        const x = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const y = (height - bounds.height * scale) / 2 - bounds.y * scale;
        svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      };
      fitRef.current = () => center(fitScale);
      // Never shrink initial labels below a readable overview size. Larger graphs
      // can be panned or explicitly fitted; all states remain available by name.
      center(Math.max(0.9, fitScale));
    }
    return () => {
      svg.on('.zoom', null);
      zoomRef.current = null;
      fitRef.current = null;
    };
  }, [data, onStateClick, theme, mode, layout, size, language]);

  useEffect(() => {
    if (!svgRef.current) return;
    const nodes = d3.select(svgRef.current).selectAll<SVGGElement, NodePosition>('.node');
    nodes.attr('aria-pressed', d => d.node.id === selectedNode?.id ? 'true' : 'false');
    nodes.select('.node-background')
      .attr('fill', d => d.node.id === selectedNode?.id ? theme.primaryLight : theme.surface)
      .attr('stroke-width', d => d.node.id === selectedNode?.id ? 3 : 2);
  }, [selectedNode, data, layout, size, theme]);

  if (!data || data.nodes.length === 0) {
    return (
      <div style={containerStyles}>
        <div style={emptyStateStyles}>{t('No valid policy to visualize')}</div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Layout toggle toolbar */}
      <div role="group" aria-label={t('Diagram controls')} style={toolbarStyles}>
        <button style={layoutButtonStyles(layoutChoice === 'auto')} aria-pressed={layoutChoice === 'auto'} onClick={() => setLayout('auto')}>{t('Auto layout')}</button>
        <button
          style={layoutButtonStyles(layoutChoice === 'horizontal')}
          aria-pressed={layoutChoice === 'horizontal'}
          onClick={() => setLayout('horizontal')}
          title={t('Horizontal layout')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 8a.5.5 0 01.5-.5h11.793l-3.147-3.146a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L13.293 8.5H1.5A.5.5 0 011 8z"/>
          </svg>
        </button>
        <button
          style={layoutButtonStyles(layoutChoice === 'vertical')}
          aria-pressed={layoutChoice === 'vertical'}
          onClick={() => setLayout('vertical')}
          title={t('Vertical layout')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.293V1.5A.5.5 0 018 1z"/>
          </svg>
        </button>
        <button style={layoutButtonStyles(false)} aria-label={t('Zoom out')} onClick={() => changeZoom(0.8)}>−</button>
        <button style={layoutButtonStyles(false)} aria-label={t('Zoom in')} onClick={() => changeZoom(1.25)}>+</button>
        <button style={layoutButtonStyles(false)} onClick={() => fitRef.current?.()}>{t('Fit diagram')}</button>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <svg ref={svgRef} aria-label={t('ISM state diagram')} />
      </div>
      <div style={{ height: '170px', flexShrink: 0, overflowY: 'auto', padding: '12px', borderTop: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>{t('State details')}<select value={selectedNode?.id || ''} onChange={event => onStateClick(event.target.value)} style={{ minWidth: 0, maxWidth: '65%', padding: '4px', color: theme.text, background: theme.surface }}>
            {data.nodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
        </label>
        {selectedNode && <div aria-live="polite">
          <p style={{ fontSize: '13px', margin: '8px 0' }}>{selectedNode.actions.map(formatActionDisplay).join('; ') || t('No actions')}</p>
          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{JSON.stringify(selectedNode.actions, null, 2)}</pre>
        </div>}
      </div>
    </div>
  );
}

/**
 * Calculate node positions based on layout direction
 */
function calculatePositions(
  nodes: DiagramNode[],
  width: number,
  height: number,
  edges: DiagramEdge[] = [],
  layout: LayoutDirection = 'horizontal'
): NodePosition[] {
  if (nodes.length === 0) return [];

  // Build adjacency list from edges
  const adjacency = new Map<string, string[]>();
  nodes.forEach(node => adjacency.set(node.id, []));
  edges.forEach(edge => {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  });

  // Find the default node
  const defaultNode = nodes.find(n => n.isDefault);
  const defaultId = defaultNode?.id || nodes[0]?.id || '';

  // Build a map of node IDs to nodes
  const nodeMap = new Map<string, DiagramNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Perform BFS from default state to determine order
  const visited = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [defaultId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);

    // Add neighbors to queue
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  // Add any unvisited nodes (unreachable states) at the end
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      order.push(node.id);
    }
  });

  // Create positions based on order and layout direction
  const positions: NodePosition[] = [];
  const nodeCount = order.length;
  
  if (layout === 'horizontal') {
    const spacing = 200;
    const startX = (width - spacing * (nodeCount - 1)) / 2;
    
    order.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);
      if (node) {
        positions.push({
          x: startX + index * spacing,
          y: height / 2,
          node,
        });
      }
    });
  } else {
    const spacing = 140;
    const startY = (height - spacing * (nodeCount - 1)) / 2;
    
    order.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);
      if (node) {
        positions.push({
          x: width / 2,
          y: startY + index * spacing,
          node,
        });
      }
    });
  }

  return positions;
}

/**
 * Calculate edge positions based on node positions
 */
function calculateEdgePositions(
  edges: DiagramEdge[],
  nodePositions: NodePosition[]
): EdgePosition[] {
  const positionMap = new Map<string, NodePosition>();
  nodePositions.forEach((pos) => positionMap.set(pos.node.id, pos));

  return edges
    .map((edge) => {
      const source = positionMap.get(edge.source);
      const target = positionMap.get(edge.target);
      if (!source || !target) return null;
      return { source, target, edge };
    })
    .filter((e): e is EdgePosition => e !== null);
}
