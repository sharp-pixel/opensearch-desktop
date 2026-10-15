// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * ConfigPanel component for chart configuration
 * Requirements: 8.1, 8.2, 8.3, 8.5, 8.7
 */

import React from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import type { PPLColumn } from '../../../../types/cell';
import type {
  ChartType,
  ChartConfig,
  SchemaAnalysis,
  PieChartConfig,
  BarChartConfig,
  HistogramConfig,
  GeoMapConfig,
} from '../../../../types/chart';

interface ConfigPanelProps {
  chartType: ChartType;
  schema: PPLColumn[];
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  schemaAnalysis: SchemaAnalysis;
}

export function ConfigPanel({
  chartType,
  schema,
  config,
  onConfigChange,
  schemaAnalysis,
}: ConfigPanelProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    marginBottom: '12px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: theme.text,
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const resetButtonStyle: React.CSSProperties = {
    fontSize: '11px',
    color: theme.primary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
  };

  const handleReset = () => {
    // Reset to default configuration based on chart type
    const defaultConfig = getDefaultConfig(chartType, schemaAnalysis);
    onConfigChange(defaultConfig);
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <span>{t('Configuration')}</span>
        <button style={resetButtonStyle} onClick={handleReset}>{t('Reset')}</button>
      </div>
      
      {chartType === 'pie' && (
        <PieConfigFields
          config={config as PieChartConfig}
          onChange={onConfigChange}
          schemaAnalysis={schemaAnalysis}
          theme={theme}
        />
      )}
      
      {chartType === 'bar' && (
        <BarConfigFields
          config={config as BarChartConfig}
          onChange={onConfigChange}
          schemaAnalysis={schemaAnalysis}
          theme={theme}
        />
      )}
      
      {chartType === 'histogram' && (
        <HistogramConfigFields
          config={config as HistogramConfig}
          onChange={onConfigChange}
          schemaAnalysis={schemaAnalysis}
          theme={theme}
        />
      )}
      
      {chartType === 'map' && (
        <MapConfigFields
          config={config as GeoMapConfig}
          onChange={onConfigChange}
          schemaAnalysis={schemaAnalysis}
          schema={schema}
          theme={theme}
        />
      )}
    </div>
  );
}

// Shared styles
const fieldStyle: React.CSSProperties = {
  marginBottom: '10px',
};

const labelStyle = (theme: ReturnType<typeof useTheme>['theme']): React.CSSProperties => ({
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: theme.textSecondary,
  marginBottom: '4px',
});

const selectStyle = (theme: ReturnType<typeof useTheme>['theme']): React.CSSProperties => ({
  width: '100%',
  padding: '6px 8px',
  fontSize: '12px',
  border: `1px solid ${theme.border}`,
  borderRadius: '4px',
  backgroundColor: theme.surface,
  color: theme.text,
});

const checkboxContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px',
};

const checkboxLabelStyle = (theme: ReturnType<typeof useTheme>['theme']): React.CSSProperties => ({
  fontSize: '11px',
  color: theme.textSecondary,
});

// Pie chart config fields
interface PieConfigFieldsProps {
  config: PieChartConfig;
  onChange: (config: ChartConfig) => void;
  schemaAnalysis: SchemaAnalysis;
  theme: ReturnType<typeof useTheme>['theme'];
}

function PieConfigFields({ config, onChange, schemaAnalysis, theme }: PieConfigFieldsProps): React.ReactElement {
  useLanguage();
  return (
    <>
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Dimension (Slices)')}</label>
        <select
          style={selectStyle(theme)}
          value={config.dimensionColumn}
          onChange={(e) => onChange({ ...config, dimensionColumn: e.target.value })}
        >
          {schemaAnalysis.dimensions.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
          {schemaAnalysis.hasClusterColumn && (
            <option value="_cluster">{t('_cluster (by cluster)')}</option>
          )}
        </select>
      </div>
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Measure (Values)')}</label>
        <select
          style={selectStyle(theme)}
          value={config.measureColumn}
          onChange={(e) => onChange({ ...config, measureColumn: e.target.value })}
        >
          {schemaAnalysis.measures.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      <div style={checkboxContainerStyle}>
        <input
          type="checkbox"
          id="showLegend"
          checked={config.showLegend}
          onChange={(e) => onChange({ ...config, showLegend: e.target.checked })}
        />
        <label htmlFor="showLegend" style={checkboxLabelStyle(theme)}>{t('Show legend')}</label>
      </div>
      
      <div style={checkboxContainerStyle}>
        <input
          type="checkbox"
          id="showPercentages"
          checked={config.showPercentages}
          onChange={(e) => onChange({ ...config, showPercentages: e.target.checked })}
        />
        <label htmlFor="showPercentages" style={checkboxLabelStyle(theme)}>{t('Show percentages')}</label>
      </div>
    </>
  );
}

// Bar chart config fields
interface BarConfigFieldsProps {
  config: BarChartConfig;
  onChange: (config: ChartConfig) => void;
  schemaAnalysis: SchemaAnalysis;
  theme: ReturnType<typeof useTheme>['theme'];
}

function BarConfigFields({ config, onChange, schemaAnalysis, theme }: BarConfigFieldsProps): React.ReactElement {
  useLanguage();
  return (
    <>
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('X-Axis (Category)')}</label>
        <select
          style={selectStyle(theme)}
          value={config.xColumn}
          onChange={(e) => onChange({ ...config, xColumn: e.target.value })}
        >
          {schemaAnalysis.dimensions.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Y-Axis (Value)')}</label>
        <select
          style={selectStyle(theme)}
          value={config.yColumn}
          onChange={(e) => onChange({ ...config, yColumn: e.target.value })}
        >
          {schemaAnalysis.measures.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Orientation')}</label>
        <select
          style={selectStyle(theme)}
          value={config.orientation}
          onChange={(e) => onChange({ ...config, orientation: e.target.value as 'vertical' | 'horizontal' })}
        >
          <option value="vertical">{t('Vertical')}</option>
          <option value="horizontal">{t('Horizontal')}</option>
        </select>
      </div>
      
      {schemaAnalysis.hasClusterColumn && (
        <>
          <div style={checkboxContainerStyle}>
            <input
              type="checkbox"
              id="groupByCluster"
              checked={config.groupByCluster}
              onChange={(e) => onChange({ ...config, groupByCluster: e.target.checked })}
            />
            <label htmlFor="groupByCluster" style={checkboxLabelStyle(theme)}>{t('Group by cluster')}</label>
          </div>
          
          {config.groupByCluster && (
            <div style={checkboxContainerStyle}>
              <input
                type="checkbox"
                id="stacked"
                checked={config.stacked}
                onChange={(e) => onChange({ ...config, stacked: e.target.checked })}
              />
              <label htmlFor="stacked" style={checkboxLabelStyle(theme)}>{t('Stacked bars')}</label>
            </div>
          )}
        </>
      )}
      
      <div style={checkboxContainerStyle}>
        <input
          type="checkbox"
          id="showLegend"
          checked={config.showLegend}
          onChange={(e) => onChange({ ...config, showLegend: e.target.checked })}
        />
        <label htmlFor="showLegend" style={checkboxLabelStyle(theme)}>{t('Show legend')}</label>
      </div>
    </>
  );
}

// Histogram config fields
interface HistogramConfigFieldsProps {
  config: HistogramConfig;
  onChange: (config: ChartConfig) => void;
  schemaAnalysis: SchemaAnalysis;
  theme: ReturnType<typeof useTheme>['theme'];
}

function HistogramConfigFields({ config, onChange, schemaAnalysis, theme }: HistogramConfigFieldsProps): React.ReactElement {
  useLanguage();
  return (
    <>
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Time Column')}</label>
        <select
          style={selectStyle(theme)}
          value={config.timeColumn}
          onChange={(e) => onChange({ ...config, timeColumn: e.target.value })}
        >
          {schemaAnalysis.temporalColumns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Measure (optional)')}</label>
        <select
          style={selectStyle(theme)}
          value={config.measureColumn || ''}
          onChange={(e) => onChange({ ...config, measureColumn: e.target.value || undefined })}
        >
          <option value="">{t('Count (rows)')}</option>
          {schemaAnalysis.measures.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Time Interval')}</label>
        <select
          style={selectStyle(theme)}
          value={config.interval}
          onChange={(e) => onChange({ ...config, interval: e.target.value as HistogramConfig['interval'] })}
        >
          <option value="auto">{t('Auto')}</option>
          <option value="minute">{t('Minute')}</option>
          <option value="hour">{t('Hour')}</option>
          <option value="day">{t('Day')}</option>
          <option value="week">{t('Week')}</option>
          <option value="month">{t('Month')}</option>
        </select>
      </div>
      
      {schemaAnalysis.hasClusterColumn && (
        <>
          <div style={checkboxContainerStyle}>
            <input
              type="checkbox"
              id="groupByCluster"
              checked={config.groupByCluster}
              onChange={(e) => onChange({ ...config, groupByCluster: e.target.checked })}
            />
            <label htmlFor="groupByCluster" style={checkboxLabelStyle(theme)}>{t('Group by cluster')}</label>
          </div>
          
          {config.groupByCluster && (
            <div style={checkboxContainerStyle}>
              <input
                type="checkbox"
                id="stacked"
                checked={config.stacked}
                onChange={(e) => onChange({ ...config, stacked: e.target.checked })}
              />
              <label htmlFor="stacked" style={checkboxLabelStyle(theme)}>{t('Stacked')}</label>
            </div>
          )}
        </>
      )}
      
      <div style={checkboxContainerStyle}>
        <input
          type="checkbox"
          id="showLegend"
          checked={config.showLegend}
          onChange={(e) => onChange({ ...config, showLegend: e.target.checked })}
        />
        <label htmlFor="showLegend" style={checkboxLabelStyle(theme)}>{t('Show legend')}</label>
      </div>
    </>
  );
}

// Map config fields
interface MapConfigFieldsProps {
  config: GeoMapConfig;
  onChange: (config: ChartConfig) => void;
  schemaAnalysis: SchemaAnalysis;
  schema: PPLColumn[];
  theme: ReturnType<typeof useTheme>['theme'];
}

function MapConfigFields({ config, onChange, schemaAnalysis, schema, theme }: MapConfigFieldsProps): React.ReactElement {
  useLanguage();
  const hasGeoPoint = schemaAnalysis.geoColumns.some(col => {
    const colDef = schema.find(c => c.name === col);
    return colDef?.type.toLowerCase() === 'geo_point';
  });

  return (
    <>
      {hasGeoPoint ? (
        <div style={fieldStyle}>
          <label style={labelStyle(theme)}>{t('Geo Column')}</label>
          <select
            style={selectStyle(theme)}
            value={config.geoColumn || ''}
            onChange={(e) => onChange({ ...config, geoColumn: e.target.value })}
          >
            {schemaAnalysis.geoColumns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle(theme)}>{t('Latitude Column')}</label>
            <select
              style={selectStyle(theme)}
              value={config.latColumn || ''}
              onChange={(e) => onChange({ ...config, latColumn: e.target.value })}
            >
              {schemaAnalysis.geoColumns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          
          <div style={fieldStyle}>
            <label style={labelStyle(theme)}>{t('Longitude Column')}</label>
            <select
              style={selectStyle(theme)}
              value={config.lonColumn || ''}
              onChange={(e) => onChange({ ...config, lonColumn: e.target.value })}
            >
              {schemaAnalysis.geoColumns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </>
      )}
      
      <div style={fieldStyle}>
        <label style={labelStyle(theme)}>{t('Marker Size')}</label>
        <select
          style={selectStyle(theme)}
          value={config.markerSize}
          onChange={(e) => onChange({ ...config, markerSize: e.target.value as 'fixed' | 'scaled' })}
        >
          <option value="fixed">{t('Fixed')}</option>
          <option value="scaled">{t('Scaled by value')}</option>
        </select>
      </div>
      
      {config.markerSize === 'scaled' && schemaAnalysis.measures.length > 0 && (
        <div style={fieldStyle}>
          <label style={labelStyle(theme)}>{t('Size Column')}</label>
          <select
            style={selectStyle(theme)}
            value={config.measureColumn || ''}
            onChange={(e) => onChange({ ...config, measureColumn: e.target.value })}
          >
            {schemaAnalysis.measures.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      )}
      
      {schemaAnalysis.hasClusterColumn && (
        <div style={checkboxContainerStyle}>
          <input
            type="checkbox"
            id="colorByCluster"
            checked={config.colorByCluster}
            onChange={(e) => onChange({ ...config, colorByCluster: e.target.checked })}
          />
          <label htmlFor="colorByCluster" style={checkboxLabelStyle(theme)}>{t('Color by cluster')}</label>
        </div>
      )}
    </>
  );
}

// Helper to get default config
function getDefaultConfig(chartType: ChartType, schemaAnalysis: SchemaAnalysis): ChartConfig {
  switch (chartType) {
    case 'pie':
      return {
        type: 'pie',
        dimensionColumn: schemaAnalysis.dimensions[0] || '',
        measureColumn: schemaAnalysis.measures[0] || '',
        maxSlices: 10,
        showLegend: true,
        showPercentages: true,
      };
    case 'bar':
      return {
        type: 'bar',
        xColumn: schemaAnalysis.dimensions[0] || '',
        yColumn: schemaAnalysis.measures[0] || '',
        orientation: 'vertical',
        groupByCluster: false,
        stacked: false,
        showLegend: true,
      };
    case 'histogram':
      return {
        type: 'histogram',
        timeColumn: schemaAnalysis.temporalColumns[0] || '',
        interval: 'auto',
        groupByCluster: false,
        stacked: false,
        showLegend: true,
      };
    case 'map':
      return {
        type: 'map',
        geoColumn: schemaAnalysis.geoColumns[0],
        colorByCluster: false,
        markerSize: 'fixed',
      };
  }
}

export default ConfigPanel;
