// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { ConnectionSelector } from '../../components/ConnectionSelector';
import { StateDiagram } from '../../features/ism/ui/StateDiagram';
import type { DiagramData } from '../../types/ism';

const connectionState = vi.hoisted(() => ({
  connections: [{ id: 'test', name: 'Test cluster', endpoint: 'https://example.test', authType: 'none', credentials: null }],
  activeConnection: null,
  setActiveConnection: vi.fn(),
  removeConnection: vi.fn(),
}));
vi.mock('../../connections/ConnectionProvider', () => ({ useConnections: () => connectionState }));
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
async function render(child: React.ReactElement) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(React.createElement(ThemeProvider, null, child)));
}
function button(name: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || b.title || b.textContent?.trim()) === name);
  expect(found, name).toBeDefined();
  return found!;
}
async function click(name: string) {
  await act(async () => button(name).click());
}

it('D04 exposes connection actions as buttons, focuses the menu, and restores focus after Escape', async () => {
  const onCreate = vi.fn();
  const onEdit = vi.fn();
  await render(React.createElement(ConnectionSelector, { onOpenConnectionSettings: onCreate, onEditConnection: onEdit }));
  const trigger = button('Not Connected');
  await click('Not Connected');
  expect(document.activeElement).toBe(button('Add New Connection'));
  expect(button('Edit connection').style.opacity).toBe('1');
  expect(button('Delete connection').style.opacity).toBe('1');
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[aria-label="Connections"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await click('Not Connected');
  await click('Add New Connection');
  expect(onCreate).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(trigger);
  await click('Not Connected');
  await click('Edit connection');
  expect(onEdit).toHaveBeenCalledWith(connectionState.connections[0]);
  await click('Not Connected');
  const selection = document.querySelector<HTMLButtonElement>('.connection-select-action')!;
  await act(async () => selection.click());
  expect(connectionState.setActiveConnection).toHaveBeenCalledWith(connectionState.connections[0]);
});

it('D04 canceling connection deletion keeps data and restores focus', async () => {
  await render(React.createElement(ConnectionSelector, { onOpenConnectionSettings: vi.fn() }));
  const trigger = button('Not Connected');
  await click('Not Connected');
  await click('Delete connection');
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.contains(document.activeElement)).toBe(true);
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(connectionState.removeConnection).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('keeps edit available when a macOS pointer click blurs the focused menu button', async () => {
  const onEdit = vi.fn();
  await render(React.createElement(ConnectionSelector, { onOpenConnectionSettings: vi.fn(), onEditConnection: onEdit }));
  await click('Not Connected');
  const edit = button('Edit connection');
  // WebKit on macOS may blur the focused control without focusing the clicked button.
  await act(async () => {
    edit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    (document.activeElement as HTMLElement).blur();
  });
  expect(edit.isConnected).toBe(true);
  await act(async () => edit.click());
  expect(onEdit).toHaveBeenCalledWith(connectionState.connections[0]);
  expect(document.querySelector('[aria-label="Connections"]')).toBeNull();
});

it('still closes the connection menu when focus or a pointer moves outside', async () => {
  await render(React.createElement(ConnectionSelector, { onOpenConnectionSettings: vi.fn() }));
  const outside = document.createElement('button');
  container.appendChild(outside);
  await click('Not Connected');
  await act(async () => outside.focus());
  expect(document.querySelector('[aria-label="Connections"]')).toBeNull();
  await click('Not Connected');
  await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(document.querySelector('[aria-label="Connections"]')).toBeNull();
});

it('D05 supports keyboard state selection with complete action details without resetting zoom', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(650);
  vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue(new DOMRect(0, 0, 260, 480));
  const data: DiagramData = {
    defaultState: 'hot', edges: [],
    nodes: [
      { id: 'hot', name: 'hot', actions: [], isDefault: true, isTerminal: false, stateType: 'default' },
      { id: 'warm', name: 'warm', actions: [{ type: 'replica_count', params: { number_of_replicas: 12 } }], isDefault: false, isTerminal: false, stateType: 'normal' },
    ],
  };
  function Harness() {
    const [selectedState, setSelectedState] = useState('hot');
    const onStateClick = useCallback((name: string) => setSelectedState(name), []);
    return React.createElement(StateDiagram, { data, selectedState, onStateClick });
  }
  await render(React.createElement(Harness));
  await click('Zoom in');
  const graph = container.querySelector('svg[aria-label="ISM state diagram"] > g')!;
  const transform = graph.getAttribute('transform');
  expect(transform).toContain('scale(1.25)');
  const warm = container.querySelector<SVGGElement>('[aria-label="View state warm"]')!;
  await act(async () => warm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  expect(warm.getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('select')?.value).toBe('warm');
  expect(container.querySelector('pre')?.textContent).toContain('"number_of_replicas": 12');
  expect(graph.getAttribute('transform')).toBe(transform);
  expect(container.querySelector('[aria-label="View state warm"]')).toBe(warm);
  await click('Fit diagram');
  expect(graph.getAttribute('transform')).toContain('scale(1)');
});

it('D06 fits a large policy even when its overview needs less than 30 percent zoom', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(650);
  vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue(new DOMRect(0, 0, 260, 5000));
  const data: DiagramData = {
    defaultState: 'state-0', edges: [],
    nodes: Array.from({ length: 36 }, (_, index) => ({
      id: `state-${index}`, name: `state-${index}`, actions: [], isDefault: index === 0, isTerminal: false, stateType: 'normal' as const,
    })),
  };
  await render(React.createElement(StateDiagram, { data, onStateClick: vi.fn() }));
  await click('Fit diagram');
  const graph = container.querySelector('svg[aria-label="ISM state diagram"] > g')!;
  const fitted = graph.getAttribute('transform');
  const scale = Number(fitted?.match(/scale\(([^)]+)\)/)?.[1]);
  expect(scale).toBeGreaterThan(0);
  expect(scale).toBeLessThan(0.3);
  expect(5000 * scale).toBeLessThanOrEqual(650 - 64);
  await click('Zoom out');
  expect(graph.getAttribute('transform')).toBe(fitted);
});
