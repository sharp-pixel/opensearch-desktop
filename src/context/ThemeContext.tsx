// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Theme Context - Provides light/dark mode theming across the application
 */

/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceHover: string;
  
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Accents
  primary: string;
  primaryHover: string;
  primaryLight: string;
  
  // Status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;
  
  // Code/Editor
  codeBackground: string;
  codeBorder: string;
  
  // Monaco editor theme
  monacoTheme: 'vs' | 'vs-dark';
}

const lightTheme: ThemeColors = {
  // Backgrounds
  background: '#f5f7fa',
  backgroundSecondary: '#fafbfd',
  backgroundTertiary: '#fff',
  surface: '#fff',
  surfaceHover: '#f5f7fa',
  
  // Text
  text: '#1a1c21',
  textSecondary: '#343741',
  textMuted: '#69707d',
  
  // Borders
  border: '#d3dae6',
  borderLight: '#e9edf3',
  
  // Accents
  primary: '#006bb4',
  primaryHover: '#005a9e',
  primaryLight: '#e6f1fa',
  
  // Status colors
  success: '#1a9c6c',
  successLight: '#e6f9f0',
  warning: '#8a6914',
  warningLight: '#fef6e6',
  error: '#bd271e',
  errorLight: '#f8e9e9',
  info: '#3b82f6',
  infoLight: '#e6f1fa',
  
  // Code/Editor
  codeBackground: '#f5f7fa',
  codeBorder: '#d3dae6',
  
  // Monaco editor theme
  monacoTheme: 'vs',
};

const darkTheme: ThemeColors = {
  // Backgrounds
  background: '#1e1e1e',
  backgroundSecondary: '#252525',
  backgroundTertiary: '#2d2d2d',
  surface: '#2d2d2d',
  surfaceHover: '#3c3c3c',
  
  // Text
  text: '#fff',
  textSecondary: '#d4d4d4',
  textMuted: '#98a2b3',
  
  // Borders
  border: '#3c3c3c',
  borderLight: '#4a4a4a',
  
  // Accents
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#2d4a6f',
  
  // Status colors
  success: '#10b981',
  successLight: '#1a3d2e',
  warning: '#f59e0b',
  warningLight: '#3d3520',
  error: '#ef4444',
  errorLight: '#3d1f1f',
  info: '#3b82f6',
  infoLight: '#2d4a6f',
  
  // Code/Editor
  codeBackground: '#1a1a1a',
  codeBorder: '#3c3c3c',
  
  // Monaco editor theme
  monacoTheme: 'vs-dark',
};

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'opensearch-devtools-theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'light';
  });

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  // Persist theme preference
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const contextValue = useMemo(
    () => ({ mode, theme, toggleTheme, setTheme }),
    [mode, theme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export themes for direct access if needed
export { lightTheme, darkTheme };
