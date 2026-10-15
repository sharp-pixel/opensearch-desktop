// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { describe, it, expect, vi } from 'vitest';
import { createSaveCoordinator } from '../../storage/saveCoordinator';

describe('save coordinator failure ownership', () => {
  it('keeps a failed document visible while other documents save', async () => {
    let fail = true;
    const changed = vi.fn();
    const saves = createSaveCoordinator<string>((id) => {
      if (id === 'a' && fail) throw new Error('Document A failed');
    }, changed);
    saves.schedule('a', 'draft', 60_000);
    expect(await saves.flush('a')).toBe(false);
    saves.schedule('b', 'other draft', 60_000);
    await saves.flush('b');
    expect(changed).toHaveBeenLastCalledWith('error', 'Document A failed');
    fail = false;
    expect(await saves.flush('a')).toBe(true);
    expect(changed).toHaveBeenLastCalledWith('saved', null);
    saves.dispose();
  });
  it('serializes an edit made while a previous revision is saving', async () => {
    let finish!: () => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const saves = createSaveCoordinator<string>(write, vi.fn());
    saves.schedule('a', 'first', 60_000);
    const first = saves.flush('a');
    saves.schedule('a', 'second', 60_000);
    const second = saves.flush('a');
    expect(write).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);
    expect(write.mock.calls).toEqual([['a', 'first'], ['a', 'second']]);
    saves.dispose();
  });
});

it('pauses pending writes during deletion and restores them if deletion fails', async () => {
  const write = vi.fn();
  const saves = createSaveCoordinator<string>(write, vi.fn());
  saves.schedule('a', 'draft', 60_000);
  saves.pause('a');
  expect(await saves.flush('a')).toBe(false);
  expect(write).not.toHaveBeenCalled();
  saves.resume('a'); await saves.flush('a');
  expect(write).toHaveBeenCalledWith('a', 'draft');
  saves.dispose();
});
