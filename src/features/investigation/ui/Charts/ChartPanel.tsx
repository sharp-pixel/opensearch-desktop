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
 * ChartPanel component - container for chart visualization
 * Requirements: 2.2, 8.4
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import type { PPLColumn } from '../../../../types/cell';
import type { ConsolidatedRow } from '../../../../types/investigation';
import type { ChartType, ChartConfig, SchemaAnalysis, ChartTypeOption } from '../../../../types/chart';
import { ChartTypeBar } from './ChartTypeBar';
import { ConfigPanel } from './ConfigPanel';
import { ChartRenderer } from './ChartRenderer';
import { getChartColorPalette } from '../../../../utils/chartColors';
import { getDisabledReason, suggestConfiguration } from '../../../../services/schemaAnalyzer';
import { exportChart, generateExportFilename, type ExportFormat } from '../../../../services/chartExporter';

interface ChartPanelProps {
  rows: ConsolidatedRow[];
  schema: PPLColumn[];
  schemaAnalysis: SchemaAnalysis;
  initialConfig?: ChartConfig;
  onConfigChange?: (config: ChartConfig) => void;
}

export function ChartPanel({
  rows,
  schema,
  schemaAnalysis,
  initialConfig,
  onConfigChange,
}: ChartPanelProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 600, height: 400 });
  const [isExporting, setIsExporting] = useState(false);
  
  // Initialize chart type and config
  const [selectedType, setSelectedType] = useState<ChartType>(() => {
    if (initialConfig) return initialConfig.type;
    return schemaAnalysis.recommendedChartType || 'bar';
  });
  
  const [config, setConfig] = useState<ChartConfig>(() => {
    if (initialConfig) return initialConfig;
    return suggestConfiguration(schemaAnalysis, selectedType);
  });

  const palette = getChartColorPalette(theme);

  // Build chart type options
  const chartTypeOptions: ChartTypeOption[] = [
    {
      type: 'pie',
      label: 'Pie',
      enabled: schemaAnalysis.compatibleChartTypes.includes('pie'),
      recommended: schemaAnalysis.recommendedChartType === 'pie',
      disabledReason: getDisabledReason(schemaAnalysis, 'pie'),
    },
    {
      type: 'bar',
      label: 'Bar',
      enabled: schemaAnalysis.compatibleChartTypes.includes('bar'),
      recommended: schemaAnalysis.recommendedChartType === 'bar',
      disabledReason: getDisabledReason(schemaAnalysis, 'bar'),
    },
    {
      type: 'histogram',
      label: 'Timeline',
      enabled: schemaAnalysis.compatibleChartTypes.includes('histogram'),
      recommended: schemaAnalysis.recommendedChartType === 'histogram',
      disabledReason: getDisabledReason(schemaAnalysis, 'histogram'),
    },
    {
      type: 'map',
      label: 'Map',
      enabled: schemaAnalysis.compatibleChartTypes.includes('map'),
      recommended: schemaAnalysis.recommendedChartType === 'map',
      disabledReason: getDisabledReason(schemaAnalysis, 'map'),
    },
  ];

  // Handle chart type change
  const handleTypeChange = (type: ChartType) => {
    setSelectedType(type);
    const newConfig = suggestConfiguration(schemaAnalysis, type);
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  // Handle config change
  const handleConfigChange = (newConfig: ChartConfig) => {
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  // Handle chart export
  const handleExport = async (format: ExportFormat) => {
    if (!chartContainerRef.current) return;
    
    const svg = chartContainerRef.current.querySelector('svg');
    if (!svg) return;
    
    setIsExporting(true);
    try {
      const filename = generateExportFilename(selectedType);
      await exportChart(svg as SVGSVGElement, {
        format,
        filename,
        scale: 2,
        backgroundColor: theme.background,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Reserve space for config panel (200px) and padding
        const chartWidth = Math.max(300, rect.width - 220);
        const chartHeight = Math.max(250, rect.height - 80);
        setChartSize({ width: chartWidth, height: chartHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '350px',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    gap: '12px',
  };

  const chartAreaStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
  };

  const configAreaStyle: React.CSSProperties = {
    width: '200px',
    flexShrink: 0,
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.textMuted,
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px',
  };

  // Check if we have data to display
  const hasData = rows.length > 0;
  const isConfigValid = validateConfig(config, schemaAnalysis);

  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChartTypeBar
          options={chartTypeOptions}
          selectedType={selectedType}
          onTypeChange={handleTypeChange}
        />
        
        {/* Export buttons */}
        {hasData && isConfigValid && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              style={{
                padding: '4px 8px',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                backgroundColor: theme.surface,
                color: theme.text,
                fontSize: '11px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={t('Export as PNG')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              PNG
            </button>
            <button
              onClick={() => handleExport('svg')}
              disabled={isExporting}
              style={{
                padding: '4px 8px',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                backgroundColor: theme.surface,
                color: theme.text,
                fontSize: '11px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={t('Export as SVG')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              SVG
            </button>
          </div>
        )}
      </div>
      
      <div style={contentStyle}>
        <div ref={chartContainerRef} style={chartAreaStyle}>
          {!hasData ? (
            <div style={emptyStateStyle}>
              <span>{t('No data to visualize')}</span>
              <span style={{ fontSize: '11px', marginTop: '4px' }}>{t('Execute a query to see chart visualization')}</span>
            </div>
          ) : !isConfigValid ? (
            <div style={emptyStateStyle}>
              <span>{t('Configure chart settings')}</span>
              <span style={{ fontSize: '11px', marginTop: '4px' }}>{t('Select columns for the chart axes')}</span>
            </div>
          ) : (
            <ChartRenderer
              config={config}
              rows={rows}
              schema={schema}
              palette={palette}
              width={chartSize.width}
              height={chartSize.height}
            />
          )}
        </div>
        
        <div style={configAreaStyle}>
          <ConfigPanel
            chartType={selectedType}
            schema={schema}
            config={config}
            onConfigChange={handleConfigChange}
            schemaAnalysis={schemaAnalysis}
          />
        </div>
      </div>
    </div>
  );
}

// Validate that config has required fields
function validateConfig(config: ChartConfig, _analysis: SchemaAnalysis): boolean {
  switch (config.type) {
    case 'pie':
      return !!(config.dimensionColumn && config.measureColumn);
    case 'bar':
      return !!(config.xColumn && config.yColumn);
    case 'histogram':
      return !!config.timeColumn;
    case 'map':
      return !!(config.geoColumn || (config.latColumn && config.lonColumn));
  }
}

export default ChartPanel;
