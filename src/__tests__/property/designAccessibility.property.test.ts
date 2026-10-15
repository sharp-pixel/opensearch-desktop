// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { ConnectionModal } from '../../components/Dialogs/ConnectionModal';

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = undefined;
  vi.unstubAllGlobals();
});
async function openForm() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  function Harness() {
    const [open, setOpen] = useState(false);
    return React.createElement(ThemeProvider, null,
      React.createElement('button', { onClick: () => setOpen(true) }, 'Open connection'),
      React.createElement(ConnectionModal, { isOpen: open, onClose: () => setOpen(false), onSave: vi.fn() }));
  }
  await act(async () => root!.render(React.createElement(Harness)));
  const trigger = container.querySelector('button')!;
  trigger.focus();
  await act(async () => trigger.click());
  return { trigger, dialog: document.querySelector<HTMLElement>('[role="dialog"]')! };
}

it('D02 moves focus into the dialog, wraps Tab in both directions, and restores focus on Escape', async () => {
  const { trigger, dialog } = await openForm();
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement?.getAttribute('placeholder')).toBe('My OpenSearch Cluster');
  expect(container.inert).toBe(true);
  const close = dialog.querySelector<HTMLElement>('[aria-label="Close modal"]')!;
  const save = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Save')!;
  save.focus();
  await act(async () => save.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(close);
  await act(async () => close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(save);
  await act(async () => save.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(container.inert).not.toBe(true);
});

it('D02 gives fields persistent labels and links required-field errors', async () => {
  const { dialog } = await openForm();
  for (const label of dialog.querySelectorAll('label')) expect(label.control).not.toBeNull();
  const save = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Save')!;
  await act(async () => save.click());
  const optionalGrpc = dialog.querySelector('input[placeholder="http://localhost:9400"]')!;
  expect(optionalGrpc.getAttribute('aria-invalid')).toBe('false');
  for (const input of dialog.querySelectorAll('input:not([placeholder="http://localhost:9400"])')) {
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(error?.textContent).toContain('required');
  }
});
