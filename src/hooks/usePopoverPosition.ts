// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

/** Keep header popovers within the viewport, including after the header wraps. */
export function usePopoverPosition(anchor: RefObject<HTMLElement | null>, open: boolean, preferredWidth: number): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const update = () => {
      const rect = anchor.current!.getBoundingClientRect();
      const width = Math.min(preferredWidth, window.innerWidth - 16);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 80);
      setPosition({
        position: 'fixed', boxSizing: 'border-box',
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top, width, minWidth: 0, marginTop: 0, transform: 'none',
        maxHeight: Math.max(64, Math.min(400, window.innerHeight - top - 8)),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = new ResizeObserver(update);
    observer.observe(anchor.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer.disconnect();
    };
  }, [anchor, open, preferredWidth]);
  return position;
}
