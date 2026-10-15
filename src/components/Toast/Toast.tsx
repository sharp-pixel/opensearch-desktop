// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../i18n';
/**
 * Custom Toast Component - Replaces OuiGlobalToastList
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface Toast {
  id: string;
  title: string;
  text?: string;
  color?: 'success' | 'warning' | 'danger' | 'primary';
}

interface ToastListProps {
  toasts: Toast[];
  dismissToast: (toast: Toast) => void;
  toastLifeTimeMs?: number;
}

const toastContainerStyles: React.CSSProperties = {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '400px',
};

const getToastStyles = (color: Toast['color'], isDark: boolean): React.CSSProperties => {
  const lightColors = {
    success: { bg: '#e6f9f0', border: '#7dcea0', icon: '#00a86b' },
    warning: { bg: '#fef6e7', border: '#f5c6a0', icon: '#b35900' },
    danger: { bg: '#fef6f6', border: '#f5a9a9', icon: '#bd271e' },
    primary: { bg: '#e6f1fa', border: '#98c6e8', icon: '#006bb4' },
  };
  const darkColors = {
    success: { bg: '#1a3d2e', border: '#10b981', icon: '#10b981' },
    warning: { bg: '#3d3520', border: '#f59e0b', icon: '#f59e0b' },
    danger: { bg: '#3d1f1f', border: '#ef4444', icon: '#ef4444' },
    primary: { bg: '#2d4a6f', border: '#3b82f6', icon: '#3b82f6' },
  };
  const colors = isDark ? darkColors : lightColors;
  const c = colors[color || 'primary'];
  
  return {
    backgroundColor: c.bg,
    border: `1px solid ${c.border}`,
    borderRadius: '6px',
    padding: '12px 16px',
    boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    animation: 'slideIn 0.2s ease-out',
  };
};

const getTitleStyles = (isDark: boolean): React.CSSProperties => ({
  margin: 0,
  fontSize: '14px',
  fontWeight: 600,
  color: isDark ? '#fff' : '#1a1c21',
});

const getTextStyles = (isDark: boolean): React.CSSProperties => ({
  margin: '4px 0 0 0',
  fontSize: '13px',
  color: isDark ? '#98a2b3' : '#69707d',
});

const getCloseButtonStyles = (isDark: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: '4px',
  cursor: 'pointer',
  color: isDark ? '#98a2b3' : '#69707d',
  marginLeft: 'auto',
  flexShrink: 0,
});

function ToastItem({ 
  toast, 
  onDismiss, 
  lifeTimeMs,
  isDark,
}: { 
  toast: Toast; 
  onDismiss: () => void; 
  lifeTimeMs: number;
  isDark: boolean;
}) {
  useLanguage();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, lifeTimeMs - 200);

    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, lifeTimeMs);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [lifeTimeMs, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div 
      style={{
        ...getToastStyles(toast.color, isDark),
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
      role="alert"
    >
      <div style={{ flex: 1 }}>
        <p style={getTitleStyles(isDark)}>{t(toast.title)}</p>
        {toast.text && <p style={getTextStyles(isDark)}>{toast.text}</p>}
      </div>
      <button 
        style={getCloseButtonStyles(isDark)} 
        onClick={handleDismiss}
        aria-label={t('Dismiss')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 6.586L12.293 2.293a1 1 0 111.414 1.414L9.414 8l4.293 4.293a1 1 0 01-1.414 1.414L8 9.414l-4.293 4.293a1 1 0 01-1.414-1.414L6.586 8 2.293 3.707a1 1 0 011.414-1.414L8 6.586z"/>
        </svg>
      </button>
    </div>
  );
}

export function ToastList({ 
  toasts, 
  dismissToast, 
  toastLifeTimeMs = 5000 
}: ToastListProps): React.ReactElement | null {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  if (toasts.length === 0) return null;

  return (
    <div style={toastContainerStyles}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast)}
          lifeTimeMs={toastLifeTimeMs}
          isDark={isDark}
        />
      ))}
    </div>
  );
}

export default ToastList;
