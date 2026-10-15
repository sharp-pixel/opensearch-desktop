// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t } from '../i18n';
/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 * Prevents entire app from crashing due to component errors
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary class component
 * Must be a class component as error boundaries require getDerivedStateFromError
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Caught an error:', { error: error.message, componentStack: errorInfo.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <h2 className="error-boundary-title">{t('Something went wrong')}</h2>
            <p className="error-boundary-message">{t('An unexpected error occurred. Please try refreshing the page.')}</p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary className="error-boundary-summary">{t('Error details')}</summary>
                <pre className="error-boundary-error-text">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button onClick={this.handleReset} className="error-boundary-button">{t('Try Again')}</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
