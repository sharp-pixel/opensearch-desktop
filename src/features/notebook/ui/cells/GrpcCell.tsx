// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
import { registerRunShortcut } from '../../../../editor/lifecycle';
import React, { useEffect, useId, useRef, useState } from 'react';
import { WorkbenchEditor as Editor } from '../../../../editor/WorkbenchEditor';
import { AccessibleDialog } from '../../../../components/Dialogs/AccessibleDialog';
import type { GrpcCell as GrpcCellType, GrpcMethod } from '../../../../types/cell';
import type { ConnectionConfig } from '../../../../types/connection';
import { GRPC_EXAMPLES } from '../../../../services/grpcExamples';
import { useTheme } from '../../../../context/ThemeContext';

interface Props {
  cell: GrpcCellType;
  connection: ConnectionConfig | null;
  isExecuting: boolean;
  onUpdate: (updates: Partial<GrpcCellType>) => void;
  onRun: () => void;
}

export function GrpcCell({ cell, connection, isExecuting, onUpdate, onRun }: Props): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const runRef = useRef(onRun);
  const executingRef = useRef(isExecuting);
  useEffect(() => { runRef.current = onRun; executingRef.current = isExecuting; }, [onRun, isExecuting]);
  const [confirmExample, setConfirmExample] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpTitleId = useId();
  const result = cell.lastResult;
  const controlStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: 4, background: theme.surface, color: theme.text };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: theme.text, fontSize: 12 }}>{t('Method')}{' '}
          <select aria-label={t('gRPC method')} value={cell.method} disabled={isExecuting} style={controlStyle}
            onChange={e => { onUpdate({ method: e.target.value as GrpcMethod, lastResult: undefined }); setConfirmExample(false); }}>
            <option value="Search">SearchService / Search</option>
            <option value="Bulk">DocumentService / Bulk</option>
          </select>
        </label>
        <button type="button" disabled={isExecuting} style={controlStyle} onClick={() => {
          if (cell.body.trim() && !confirmExample) { setConfirmExample(true); return; }
          onUpdate({ body: GRPC_EXAMPLES[cell.method], lastResult: undefined }); setConfirmExample(false);
        }}>{confirmExample ? t('Replace request with example') : t('Load example')}</button>
        {confirmExample && <button type="button" style={controlStyle} onClick={() => setConfirmExample(false)}>{t('Cancel')}</button>}
        <button
          type="button"
          aria-label={t('gRPC help')}
          aria-haspopup="dialog"
          aria-expanded={showHelp}
          title={t('gRPC help')}
          onClick={() => setShowHelp(true)}
          style={{ ...controlStyle, width: 28, height: 28, padding: 0, borderRadius: '50%', cursor: 'pointer' }}
        >?</button>
      </div>
      {showHelp && (
        <AccessibleDialog
          labelledBy={helpTitleId}
          onDismiss={() => setShowHelp(false)}
          style={{ width: 460, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', padding: 20, border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text }}
        >
          <h2 id={helpTitleId} style={{ margin: '0 0 12px', fontSize: 18 }}>{t('gRPC help')}</h2>
          <p style={{ fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
            {connection?.grpcEndpoint || t('Set a gRPC endpoint in Connection settings to run this cell.')}
            {' · '}OpenSearch Protobuf 1.2.0
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>{t('Write the Protobuf request as JSON using snake_case fields. Search queries go inside')}{' '}<code>search_request_body</code>.
            {' '}{t('Byte fields (including Bulk documents and response')}{' '}<code>x_source</code>{t(') use Base64.')}{' '}<a href="https://docs.opensearch.org/latest/api-reference/grpc-apis/" target="_blank" rel="noreferrer" style={{ color: theme.primary }}>{t('API reference')}</a>
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" data-autofocus style={controlStyle} onClick={() => setShowHelp(false)}>{t('Close')}</button>
          </div>
        </AccessibleDialog>
      )}
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <Editor height="230px" language="json"  value={cell.body}

          onChange={value => { onUpdate({ body: value || '' }); setConfirmExample(false); }}
          onMount={(editor, monaco) => {
            registerRunShortcut(editor, monaco, () => runRef.current(), () => executingRef.current);
          }}
          options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, readOnly: isExecuting }} />
      </div>
      {result && <div aria-live="polite">
        <div style={{ color: result.success ? theme.success : theme.error, fontSize: 12, marginBottom: 6 }}>
          {result.grpcStatus === null ? t('Request error') : t('gRPC {arg0}{arg1}', { arg0: result.grpcStatus, arg1: result.success ? ' · OK' : ' · Error' })}
          {' · '}{result.duration} ms
        </div>
        <pre style={{ margin: 0, padding: 12, maxHeight: 400, overflow: 'auto', fontSize: 12, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}>
          {JSON.stringify(result.body, null, 2)}
        </pre>
      </div>}
    </div>
  );
}
