// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Timeline Panel Component
 * Visualization of simulated ISM policy execution over time
 */

import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import type { TimelineData, SimulationParams } from '../../../types/ism';

interface TimelinePanelProps {
  data: TimelineData | null;
  params: SimulationParams;
  onParamsChange: (params: SimulationParams) => void;
}

export function TimelinePanel({
  data,
  params,
  onParamsChange,
}: TimelinePanelProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.background,
    color: theme.textSecondary,
  };

  const paramsStyles: React.CSSProperties = {
    padding: '12px',
    borderBottom: `1px solid ${theme.border}`,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  };

  const paramGroupStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '11px',
    color: theme.textMuted,
    fontWeight: 500,
  };

  const inputStyles: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: '12px',
    backgroundColor: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    color: theme.textSecondary,
    width: '100%',
  };

  const timelineContainerStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  };

  const eventStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '16px',
  };

  const eventContentStyles: React.CSSProperties = {
    flex: 1,
  };

  const eventHeaderStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  };

  const stateNameStyles: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.text,
  };

  const arrowStyles: React.CSSProperties = {
    color: theme.textMuted,
    fontSize: '12px',
  };

  const timestampStyles: React.CSSProperties = {
    fontSize: '11px',
    color: theme.textMuted,
  };

  const triggerStyles: React.CSSProperties = {
    fontSize: '12px',
    color: theme.textMuted,
    marginBottom: '4px',
  };

  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  };

  const actionBadgeStyles: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: theme.primaryLight,
    color: theme.primary,
    borderRadius: '3px',
  };

  const statsStyles: React.CSSProperties = {
    fontSize: '11px',
    color: theme.textMuted,
    marginTop: '4px',
  };

  const emptyStateStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.textMuted,
    fontSize: '14px',
  };

  const summaryStyles: React.CSSProperties = {
    padding: '12px',
    borderTop: `1px solid ${theme.border}`,
    backgroundColor: theme.backgroundSecondary,
  };

  const summaryTextStyles: React.CSSProperties = {
    fontSize: '12px',
    color: theme.textMuted,
  };
  const handleParamChange = (key: keyof SimulationParams, value: string | number) => {
    onParamsChange({
      ...params,
      [key]: value,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={containerStyles}>
      {data?.warning && <p role="status" style={summaryStyles}>{data.warning}</p>}
      <div style={paramsStyles}>
        <div style={paramGroupStyles}>
          <label style={labelStyles}>{t('Simulation Days')}</label>
          <input
            type="number"
            style={inputStyles}
            value={params.simulationDays}
            onChange={(e) => handleParamChange('simulationDays', parseInt(e.target.value) || 120)}
            min={1}
            max={365}
          />
        </div>
        <div style={paramGroupStyles}>
          <label style={labelStyles}>{t('Initial Size (MB)')}</label>
          <input
            type="number"
            style={inputStyles}
            value={Math.round(params.initialSize / (1024 * 1024))}
            onChange={(e) => handleParamChange('initialSize', (parseInt(e.target.value) || 100) * 1024 * 1024)}
            min={1}
          />
        </div>
        <div style={paramGroupStyles}>
          <label style={labelStyles}>{t('Size Growth (MB/day)')}</label>
          <input
            type="number"
            style={inputStyles}
            value={Math.round(params.sizeGrowthRate / (1024 * 1024))}
            onChange={(e) => handleParamChange('sizeGrowthRate', (parseInt(e.target.value) || 10) * 1024 * 1024)}
            min={0}
          />
        </div>
        <div style={paramGroupStyles}>
          <label style={labelStyles}>{t('Initial Doc Count')}</label>
          <input
            type="number"
            style={inputStyles}
            value={params.initialDocCount}
            onChange={(e) => handleParamChange('initialDocCount', parseInt(e.target.value) || 10000)}
            min={0}
          />
        </div>
        <div style={paramGroupStyles}>
          <label style={labelStyles}>{t('Doc Growth (docs/day)')}</label>
          <input
            type="number"
            style={inputStyles}
            value={params.docGrowthRate}
            onChange={(e) => handleParamChange('docGrowthRate', parseInt(e.target.value) || 1000)}
            min={0}
          />
        </div>
      </div>

      <div style={timelineContainerStyles}>
        {!data || data.events.length === 0 ? (
          <div style={emptyStateStyles}>{t('No timeline data available')}</div>
        ) : (
          data.events.map((event, index) => (
            <div key={index} style={eventStyles}>
              <div 
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  marginTop: '4px',
                  flexShrink: 0,
                  backgroundColor: event.toState === 'delete' ? theme.error : 
                                   index === 0 ? theme.info : theme.success,
                }}
              />
              <div style={eventContentStyles}>
                <div style={eventHeaderStyles}>
                  {event.fromState && (
                    <>
                      <span style={stateNameStyles}>{event.fromState}</span>
                      <span style={arrowStyles}>→</span>
                    </>
                  )}
                  <span style={stateNameStyles}>{event.toState}</span>
                  <span style={timestampStyles}>
                    {formatDate(event.timestamp)}
                  </span>
                </div>
                <div style={triggerStyles}>{event.triggeredBy}</div>
                {event.actions.length > 0 && (
                  <div style={actionsStyles}>
                    {event.actions.map((action, i) => (
                      <span key={i} style={actionBadgeStyles}>{action}</span>
                    ))}
                  </div>
                )}
                <div style={statsStyles}>{t('Age:')}{' '}{event.indexAge}{' '}{t('| Size:')}{' '}{event.estimatedSize}{' '}{t('| Docs:')}{' '}{event.estimatedDocCount?.toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.events.length > 0 && (
        <div style={summaryStyles}>
          <div style={summaryTextStyles}>{t('Final state:')}{' '}<strong>{data.finalState}</strong>{' '}{t('| Total duration:')}{' '}{Math.round(data.totalDuration / (1000 * 60 * 60 * 24))}{' '}{t('days | Transitions:')}{' '}{data.events.length - 1}
          </div>
        </div>
      )}
    </div>
  );
}
