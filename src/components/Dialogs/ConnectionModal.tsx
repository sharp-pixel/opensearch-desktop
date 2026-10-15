// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../i18n';
/**
 * Connection Settings Modal Component
 * Allows users to configure OpenSearch cluster connection settings
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState, useCallback, useEffect, useId } from 'react';
import { isDesktopApp } from '../../platform/runtime';
import { AccessibleDialog } from './AccessibleDialog';
import { VisibilityIcon } from '../Icons/VisibilityIcon';
import { useTheme } from '../../context/ThemeContext';
import type {
  ConnectionConfig,
  AuthType,
  BasicAuthCredentials,
  ApiKeyCredentials,
  SigV4Credentials,
} from '../../types/connection';
import { DEFAULT_GRPC_ENDPOINT, validateGrpcEndpoint } from '../../services/grpcEndpoint';
import { validateConnection } from '../../services/queryExecutor';

export interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: ConnectionConfig) => void | Promise<void>;
  existingConnection?: ConnectionConfig | null;
}

interface FormState {
  name: string;
  endpoint: string;
  grpcEndpoint: string;
  authType: AuthType;
  username: string;
  password: string;
  apiKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  service: 'es' | 'aoss';
  useProxy: boolean;
}

interface ValidationState {
  isValidating: boolean;
  validationResult: {
    valid: boolean;
    error?: string;
    clusterName?: string;
    clusterStatus?: string;
    certificateUrl?: string;
  } | null;
}

const AUTH_TYPE_OPTIONS = [
  { value: 'none', text: 'No Authentication' },
  { value: 'basic', text: 'Basic Authentication' },
  { value: 'apikey', text: 'API Key' },
  { value: 'sigv4', text: 'IAM (SigV4) - Amazon OpenSearch Service' },
];

const getModalStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  borderRadius: '8px',
  boxShadow: isDark ? '0 4px 24px rgba(0, 0, 0, 0.5)' : '0 4px 24px rgba(0, 0, 0, 0.2)',
  width: '500px',
  maxWidth: '90vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const getHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const getTitleStyles = (isDark: boolean): React.CSSProperties => ({
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: isDark ? '#fff' : '#1a1c21',
});

const bodyStyles: React.CSSProperties = {
  padding: '20px',
  overflowY: 'auto',
  flex: 1,
};

const getFooterStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderTop: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: isDark ? '#252525' : '#f5f7fa',
});

const formRowStyles: React.CSSProperties = {
  marginBottom: '16px',
};

const getLabelStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'block',
  marginBottom: '4px',
  fontSize: '14px',
  fontWeight: 500,
  color: isDark ? '#fff' : '#1a1c21',
});

const getHelpTextStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '12px',
  color: isDark ? '#98a2b3' : '#69707d',
  marginTop: '4px',
});

const getInputStyles = (isDark: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '4px',
  outline: 'none',
  transition: 'border-color 0.15s',
  backgroundColor: isDark ? '#1e1e1e' : '#fff',
  color: isDark ? '#fff' : '#1a1c21',
});

const getSelectStyles = (isDark: boolean): React.CSSProperties => ({
  ...getInputStyles(isDark),
  backgroundColor: isDark ? '#1e1e1e' : '#fff',
  cursor: 'pointer',
});

const getErrorInputStyles = (isDark: boolean): React.CSSProperties => ({
  ...getInputStyles(isDark),
  borderColor: isDark ? '#ef4444' : '#bd271e',
});

const getErrorTextStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '12px',
  color: isDark ? '#ef4444' : '#bd271e',
  marginTop: '4px',
});

const buttonStyles: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
};

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#006bb4',
  color: '#fff',
};

const getTextButtonStyles = (isDark: boolean): React.CSSProperties => ({
  ...buttonStyles,
  backgroundColor: 'transparent',
  color: isDark ? '#3b82f6' : '#006bb4',
});

const getIconButtonStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '6px',
  borderRadius: '4px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: isDark ? '#fff' : '#1a1c21',
});

const getSuccessBoxStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#1a3d2e' : '#e6f9f0',
  border: `1px solid ${isDark ? '#10b981' : '#7dcea0'}`,
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '16px',
  color: isDark ? '#10b981' : '#006d4e',
});

const getErrorBoxStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#3d1f1f' : '#fef6f6',
  border: `1px solid ${isDark ? '#ef4444' : '#f5a9a9'}`,
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '16px',
  color: isDark ? '#ef4444' : '#bd271e',
});

const getInfoBoxStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#2d4a6f' : '#f0f7fc',
  border: `1px solid ${isDark ? '#3b82f6' : '#98c6e8'}`,
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '16px',
  fontSize: '13px',
  color: isDark ? '#3b82f6' : '#006bb4',
});

const getWarningBoxStyles = (isDark: boolean): React.CSSProperties => ({
  marginTop: '12px',
  padding: '10px',
  backgroundColor: isDark ? '#3d3520' : '#fff5e6',
  borderRadius: '4px',
  border: `1px solid ${isDark ? '#f59e0b' : '#f5c6a0'}`,
});

/**
 * Generate a unique ID for new connections
 */
function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * ConnectionModal component for configuring OpenSearch cluster connections
 */
export function ConnectionModal({
  isOpen,
  onClose,
  onSave,
  existingConnection,
}: ConnectionModalProps) {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const formId = useId();
  const fieldId = (field: string) => `${formId}-${field}`;
  const fieldProps = (field: string) => ({
    id: fieldId(field),
    'aria-invalid': !!errors[field],
    'aria-describedby': errors[field] ? `${fieldId(field)}-error` : undefined,
  });
  const [formState, setFormState] = useState<FormState>({
    name: '',
    endpoint: '',
    grpcEndpoint: DEFAULT_GRPC_ENDPOINT,
    authType: 'none',
    username: '',
    password: '',
    apiKey: '',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: 'us-east-1',
    service: 'es',
    useProxy: false,
  });

  const [validation, setValidation] = useState<ValidationState>({
    isValidating: false,
    validationResult: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Initialize form with existing connection data
  useEffect(() => {
    if (existingConnection) {
      const basicCreds = existingConnection.credentials as BasicAuthCredentials | null;
      const apiKeyCreds = existingConnection.credentials as ApiKeyCredentials | null;
      const sigv4Creds = existingConnection.credentials as SigV4Credentials | null;

      setFormState({
        name: existingConnection.name,
        endpoint: existingConnection.endpoint,
        grpcEndpoint: existingConnection.grpcEndpoint ?? DEFAULT_GRPC_ENDPOINT,
        authType: existingConnection.authType,
        username: existingConnection.authType === 'basic' ? basicCreds?.username || '' : '',
        password: existingConnection.authType === 'basic' ? basicCreds?.password || '' : '',
        apiKey: existingConnection.authType === 'apikey' ? apiKeyCreds?.apiKey || '' : '',
        accessKeyId: existingConnection.authType === 'sigv4' ? sigv4Creds?.accessKeyId || '' : '',
        secretAccessKey: existingConnection.authType === 'sigv4' ? sigv4Creds?.secretAccessKey || '' : '',
        sessionToken: existingConnection.authType === 'sigv4' ? sigv4Creds?.sessionToken || '' : '',
        region: existingConnection.authType === 'sigv4' ? sigv4Creds?.region || 'us-east-1' : 'us-east-1',
        service: existingConnection.authType === 'sigv4' ? sigv4Creds?.service || 'es' : 'es',
        useProxy: existingConnection.useProxy || false,
      });
    } else {
      setFormState({
        name: '',
        endpoint: '',
        grpcEndpoint: DEFAULT_GRPC_ENDPOINT,
        authType: 'none',
        username: '',
        password: '',
        apiKey: '',
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: 'us-east-1',
        service: 'es',
        useProxy: false,
      });
    }
    setValidation({ isValidating: false, validationResult: null });
    setErrors({});
  }, [existingConnection, isOpen]);

  const handleFieldChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.value;
        setFormState((prev) => ({ ...prev, [field]: value }));
        setValidation({ isValidating: false, validationResult: null });
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      },
    [setFormState, setValidation, setErrors]
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formState.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!formState.endpoint.trim()) {
      newErrors.endpoint = 'Endpoint URL is required';
    } else {
      try {
        new URL(formState.endpoint);
      } catch {
        newErrors.endpoint = 'Please enter a valid URL';
      }
    }

    if (formState.grpcEndpoint.trim()) {
      try { validateGrpcEndpoint(formState.grpcEndpoint.trim()); }
      catch (error) { newErrors.grpcEndpoint = (error as Error).message; }
    }

    if (formState.authType === 'basic') {
      if (!formState.username.trim()) {
        newErrors.username = 'Username is required for basic authentication';
      }
    }

    if (formState.authType === 'apikey') {
      if (!formState.apiKey.trim()) {
        newErrors.apiKey = 'API key is required';
      }
    }

    if (formState.authType === 'sigv4') {
      if (!formState.accessKeyId.trim()) {
        newErrors.accessKeyId = 'Access Key ID is required';
      }
      if (!formState.secretAccessKey.trim()) {
        newErrors.secretAccessKey = 'Secret Access Key is required';
      }
      if (!formState.region.trim()) {
        newErrors.region = 'Region is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState, setErrors]);

  const buildConnectionConfig = useCallback((): ConnectionConfig => {
    let credentials: BasicAuthCredentials | ApiKeyCredentials | SigV4Credentials | null = null;

    if (formState.authType === 'basic') {
      credentials = {
        username: formState.username,
        password: formState.password,
      };
    } else if (formState.authType === 'apikey') {
      credentials = {
        apiKey: formState.apiKey,
      };
    } else if (formState.authType === 'sigv4') {
      credentials = {
        accessKeyId: formState.accessKeyId,
        secretAccessKey: formState.secretAccessKey,
        sessionToken: formState.sessionToken || undefined,
        region: formState.region,
        service: formState.service,
      };
    }

    return {
      id: existingConnection?.id || generateConnectionId(),
      name: formState.name.trim(),
      endpoint: formState.endpoint.trim(),
      grpcEndpoint: formState.grpcEndpoint.trim() || undefined,
      authType: formState.authType,
      credentials,
      useProxy: formState.useProxy,
    };
  }, [formState, existingConnection]);

  const handleValidateConnection = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setValidation({ isValidating: true, validationResult: null });

    const config = buildConnectionConfig();
    const result = await validateConnection(config);

    setValidation({
      isValidating: false,
      validationResult: result,
    });
  }, [validateForm, buildConnectionConfig, setValidation]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setValidation({ isValidating: true, validationResult: null });

    try {
      const config = buildConnectionConfig();
      const result = await validateConnection(config);
      setValidation({ isValidating: result.valid, validationResult: result });
      if (result.valid) {
        await onSave(config);
        onClose();
      }
    } catch (error) {
      setValidation({ isValidating: false, validationResult: {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to save connection',
      } });
    } finally {
      setValidation(previous => ({ ...previous, isValidating: false }));
    }
  }, [validateForm, buildConnectionConfig, onSave, onClose, setValidation]);

  const handleClose = useCallback(() => {
    setFormState({
      name: '',
      endpoint: '',
      grpcEndpoint: DEFAULT_GRPC_ENDPOINT,
      authType: 'none',
      username: '',
      password: '',
      apiKey: '',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      region: 'us-east-1',
      service: 'es',
      useProxy: false,
    });
    setValidation({ isValidating: false, validationResult: null });
    setErrors({});
    onClose();
  }, [onClose, setFormState, setValidation, setErrors]);

  if (!isOpen) {
    return null;
  }

  return (
    <AccessibleDialog labelledBy={`${formId}-title`} onDismiss={handleClose} style={getModalStyles(isDark)}>
        {/* Header */}
        <div style={getHeaderStyles(isDark)}>
          <h2 id={`${formId}-title`} style={getTitleStyles(isDark)}>
            {existingConnection ? t('Edit Connection') : t('New Connection')}
          </h2>
          <button
            style={getIconButtonStyles(isDark)}
            onClick={handleClose}
            aria-label={t('Close modal')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 6.586L12.293 2.293a1 1 0 111.414 1.414L9.414 8l4.293 4.293a1 1 0 01-1.414 1.414L8 9.414l-4.293 4.293a1 1 0 01-1.414-1.414L6.586 8 2.293 3.707a1 1 0 011.414-1.414L8 6.586z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyles}>
          <form onSubmit={(e) => e.preventDefault()}>
            {/* Connection Name */}
            <div style={formRowStyles}>
              <label htmlFor={fieldId('name')} style={getLabelStyles(isDark)}>{t('Connection Name')}</label>
              <input
{...fieldProps('name')} data-autofocus                 type="text"
                placeholder={t('My OpenSearch Cluster')}
                value={formState.name}
                onChange={handleFieldChange('name')}
                style={errors.name ? getErrorInputStyles(isDark) : getInputStyles(isDark)}
              />
              {errors.name && <div id={`${fieldId('name')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.name)}</div>}
            </div>

            {/* Endpoint URL */}
            <div style={formRowStyles}>
              <label htmlFor={fieldId('endpoint')} style={getLabelStyles(isDark)}>{t('Endpoint URL')}</label>
              <input
{...fieldProps('endpoint')}                 type="text"
                placeholder="https://localhost:9200"
                value={formState.endpoint}
                onChange={handleFieldChange('endpoint')}
                style={errors.endpoint ? getErrorInputStyles(isDark) : getInputStyles(isDark)}
              />
              <div style={getHelpTextStyles(isDark)}>{t('The base URL of your OpenSearch cluster')}</div>
              {errors.endpoint && <div id={`${fieldId('endpoint')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.endpoint)}</div>}
            </div>

            <div style={formRowStyles}>
              <label htmlFor={fieldId('grpcEndpoint')} style={getLabelStyles(isDark)}>{t('gRPC endpoint (optional)')}</label>
              <input {...fieldProps('grpcEndpoint')} type="text" placeholder={DEFAULT_GRPC_ENDPOINT}
                value={formState.grpcEndpoint} onChange={handleFieldChange('grpcEndpoint')}
                style={errors.grpcEndpoint ? getErrorInputStyles(isDark) : getInputStyles(isDark)} />
              <div style={getHelpTextStyles(isDark)}>{t('Use http:// for plaintext or https:// for TLS. gRPC TLS requires a trusted server certificate. Uses this connection’s authentication. Enable gRPC transport on your cluster first. Test Connection checks the REST endpoint.')}</div>
              {errors.grpcEndpoint && <div id={`${fieldId('grpcEndpoint')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.grpcEndpoint)}</div>}
            </div>

            {/* Proxy option for localhost HTTPS */}
            {(() => {
              try {
                const url = new URL(formState.endpoint);
                const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
                const isHttps = url.protocol === 'https:';
                if (isLocalhost && isHttps) {
                  if (isDesktopApp()) {
                    return <div style={getHelpTextStyles(isDark)}>{t('Self-signed certificates are accepted automatically for localhost REST connections in the desktop app.')}</div>;
                  }
                  if (!import.meta.env.DEV) return null;
                  return (
                    <div style={formRowStyles}>
                      <label style={{ ...getLabelStyles(isDark), display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formState.useProxy}
                          onChange={(e) => setFormState(prev => ({ ...prev, useProxy: e.target.checked }))}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />{t('Use development proxy (bypass SSL certificate)')}</label>
                      <div style={getHelpTextStyles(isDark)}>{t('Enable this to connect to localhost with self-signed certificates during development. Requests will be proxied through the Vite dev server.')}</div>
                    </div>
                  );
                }
                return null;
              } catch {
                return null;
              }
            })()}

            {/* Authentication Method */}
            <div style={formRowStyles}>
              <label htmlFor={fieldId('authType')} style={getLabelStyles(isDark)}>{t('Authentication Method')}</label>
              <select
{...fieldProps('authType')}                 value={formState.authType}
                onChange={handleFieldChange('authType')}
                style={getSelectStyles(isDark)}
              >
                {AUTH_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.text)}
                  </option>
                ))}
              </select>
            </div>

            {/* Basic Auth Fields */}
            {formState.authType === 'basic' && (
              <>
                <div style={formRowStyles}>
                  <label htmlFor={fieldId('username')} style={getLabelStyles(isDark)}>{t('Username')}</label>
                  <input
{...fieldProps('username')}                     type="text"
                    placeholder="admin"
                    value={formState.username}
                    onChange={handleFieldChange('username')}
                    style={errors.username ? getErrorInputStyles(isDark) : getInputStyles(isDark)}
                  />
                  {errors.username && <div id={`${fieldId('username')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.username)}</div>}
                </div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('password')} style={getLabelStyles(isDark)}>{t('Password')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
{...fieldProps('password')}                       type={showPassword ? 'text' : 'password'}
                      placeholder={t('Password')}
                      value={formState.password}
                      onChange={handleFieldChange('password')}
                      style={{ ...getInputStyles(isDark), paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t('Hide password') : t('Show password')}
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: isDark ? '#98a2b3' : '#69707d',
                      }}
                    >
                      <VisibilityIcon visible={showPassword} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* API Key Field */}
            {formState.authType === 'apikey' && (
              <div style={formRowStyles}>
                <label htmlFor={fieldId('apiKey')} style={getLabelStyles(isDark)}>{t('API Key')}</label>
                <div style={{ position: 'relative' }}>
                  <input
{...fieldProps('apiKey')}                     type={showApiKey ? 'text' : 'password'}
                    placeholder={t('Your API key')}
                    value={formState.apiKey}
                    onChange={handleFieldChange('apiKey')}
                    style={{
                      ...(errors.apiKey ? getErrorInputStyles(isDark) : getInputStyles(isDark)),
                      paddingRight: '40px',
                    }}
                  />
                  <button
                    type="button"
                      aria-label={showApiKey ? t('Hide API key') : t('Show API key')}
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: isDark ? '#98a2b3' : '#69707d',
                    }}
                  >
                    <VisibilityIcon visible={showApiKey} />
                  </button>
                </div>
                {errors.apiKey && <div id={`${fieldId('apiKey')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.apiKey)}</div>}
              </div>
            )}

            {/* SigV4 (IAM) Fields */}
            {formState.authType === 'sigv4' && (
              <>
                <div style={getInfoBoxStyles(isDark)}>
                  <strong>{t('Tip:')}</strong>{' '}{t('Use IAM credentials with permissions for Amazon OpenSearch Service or Serverless. For temporary credentials (e.g., from STS), include the Session Token.')}</div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('service')} style={getLabelStyles(isDark)}>{t('Service Type')}</label>
                  <select
{...fieldProps('service')}                     value={formState.service}
                    onChange={handleFieldChange('service')}
                    style={getSelectStyles(isDark)}
                  >
                    <option value="es">{t('OpenSearch Service (Managed)')}</option>
                    <option value="aoss">{t('OpenSearch Serverless')}</option>
                  </select>
                  <div style={getHelpTextStyles(isDark)}>
                    {formState.service === 'es' 
                      ? t('For Amazon OpenSearch Service managed domains')
                      : t('For Amazon OpenSearch Serverless collections')}
                  </div>
                </div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('region')} style={getLabelStyles(isDark)}>{t('AWS Region')}</label>
                  <input
{...fieldProps('region')}                     type="text"
                    placeholder="us-east-1"
                    value={formState.region}
                    onChange={handleFieldChange('region')}
                    style={errors.region ? getErrorInputStyles(isDark) : getInputStyles(isDark)}
                  />
                  {errors.region && <div id={`${fieldId('region')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.region)}</div>}
                </div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('accessKeyId')} style={getLabelStyles(isDark)}>{t('Access Key ID')}</label>
                  <input
{...fieldProps('accessKeyId')}                     type="text"
                    placeholder={t('AKIAIOSFODNN7EXAMPLE')}
                    value={formState.accessKeyId}
                    onChange={handleFieldChange('accessKeyId')}
                    style={errors.accessKeyId ? getErrorInputStyles(isDark) : getInputStyles(isDark)}
                  />
                  {errors.accessKeyId && <div id={`${fieldId('accessKeyId')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.accessKeyId)}</div>}
                </div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('secretAccessKey')} style={getLabelStyles(isDark)}>{t('Secret Access Key')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
{...fieldProps('secretAccessKey')}                       type={showPassword ? 'text' : 'password'}
                      placeholder={t('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')}
                      value={formState.secretAccessKey}
                      onChange={handleFieldChange('secretAccessKey')}
                      style={{
                        ...(errors.secretAccessKey ? getErrorInputStyles(isDark) : getInputStyles(isDark)),
                        paddingRight: '40px',
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t('Hide secret access key') : t('Show secret access key')}
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: isDark ? '#98a2b3' : '#69707d',
                      }}
                    >
                      <VisibilityIcon visible={showPassword} />
                    </button>
                  </div>
                  {errors.secretAccessKey && <div id={`${fieldId('secretAccessKey')}-error`} role="alert" style={getErrorTextStyles(isDark)}>{t(errors.secretAccessKey)}</div>}
                </div>

                <div style={formRowStyles}>
                  <label htmlFor={fieldId('sessionToken')} style={getLabelStyles(isDark)}>{t('Session Token (Optional)')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
{...fieldProps('sessionToken')}                       type={showApiKey ? 'text' : 'password'}
                      placeholder={t('For temporary credentials from STS')}
                      value={formState.sessionToken}
                      onChange={handleFieldChange('sessionToken')}
                      style={{ ...getInputStyles(isDark), paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      aria-label={showApiKey ? t('Hide session token') : t('Show session token')}
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: isDark ? '#98a2b3' : '#69707d',
                      }}
                    >
                      <VisibilityIcon visible={showApiKey} />
                    </button>
                  </div>
                  <div style={getHelpTextStyles(isDark)}>{t('Required when using temporary credentials (e.g., IAM roles, STS)')}</div>
                </div>
              </>
            )}

            {/* Validation Result */}
            {validation.validationResult && (
              validation.validationResult.valid ? (
                <div style={getSuccessBoxStyles(isDark)}>
                  <strong>{t('Connection successful')}</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>{t('Connected to cluster:')}{' '}<strong>{validation.validationResult.clusterName}</strong>
                    <br />{t('Status:')}{' '}<strong>{validation.validationResult.clusterStatus}</strong>
                  </p>
                </div>
              ) : (
                <div role="alert" style={getErrorBoxStyles(isDark)}>
                  <strong>{t('Connection failed')}</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                    {validation.validationResult.error}
                  </p>
                  {validation.validationResult.certificateUrl && (
                    <div style={getWarningBoxStyles(isDark)}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: isDark ? '#f59e0b' : '#8a6d3b' }}>
                        <strong>{t('SSL Certificate Issue')}</strong>
                      </p>
                      {validation.validationResult.certificateUrl.includes('localhost') || validation.validationResult.certificateUrl.includes('127.0.0.1') ? (
                        <>
                          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: isDark ? '#f59e0b' : '#8a6d3b' }}>{t('Your local OpenSearch is using HTTPS with a self-signed certificate. You need to accept the certificate in your browser first:')}</p>
                          <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px', fontSize: '12px', color: isDark ? '#f59e0b' : '#8a6d3b' }}>
                            <li>{t('Click the button below to open the endpoint')}</li>
                            <li>{t('Accept the security warning in your browser')}</li>
                            <li>{t('Come back here and click "Test Connection" again')}</li>
                          </ol>
                          <a
                            href={validation.validationResult.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '8px 16px',
                              backgroundColor: '#006bb4',
                              color: '#fff',
                              borderRadius: '4px',
                              fontSize: '13px',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >{t('Accept Certificate for')}{' '}{new URL(validation.validationResult.certificateUrl).host} →
                          </a>
                          <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#98a2b3' }}>
                            <strong>{t('Alternative:')}</strong>{' '}{t('Use')}{' '}<code style={{ backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa', padding: '2px 4px', borderRadius: '2px' }}>http://localhost:9200</code>{' '}{t('instead of HTTPS if your cluster allows it.')}</p>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: isDark ? '#f59e0b' : '#8a6d3b' }}>{t('The server\'s SSL certificate could not be verified. This may be a self-signed certificate. Open the link below to accept the certificate:')}</p>
                          <a
                            href={validation.validationResult.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              backgroundColor: '#006bb4',
                              color: '#fff',
                              borderRadius: '4px',
                              fontSize: '12px',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >{t('Open')}{' '}{new URL(validation.validationResult.certificateUrl).origin} →
                          </a>
                          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#98a2b3' }}>{t('After accepting the certificate, come back and try connecting again.')}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </form>
        </div>

        {/* Footer */}
        <div style={getFooterStyles(isDark)}>
          <button
            style={getTextButtonStyles(isDark)}
            onClick={handleValidateConnection}
            disabled={validation.isValidating}
          >
            {validation.isValidating ? t('Testing...') : t('Test Connection')}
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={getTextButtonStyles(isDark)} onClick={handleClose}>{t('Cancel')}</button>
            <button
              style={{
                ...primaryButtonStyles,
                opacity: validation.isValidating ? 0.7 : 1,
                cursor: validation.isValidating ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSave}
              disabled={validation.isValidating}
            >
              {validation.isValidating ? t('Validating...') : t('Save')}
            </button>
          </div>
        </div>
    </AccessibleDialog>
  );
}

export default ConnectionModal;
