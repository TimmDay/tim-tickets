'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * State + dismissal behavior for a tap-to-open tooltip (EpicChip's description bubble,
 * EpicCard's ⓘ description popover): mobile browsers hold the tap-simulated `:hover` state
 * open until the next tap, so a tooltip opened by tapping its trigger would otherwise stay
 * pinned in place while the page scrolls underneath it. Closes on any scroll, and on a tap
 * outside the element the returned ref is attached to.
 */
export function useTapTooltip<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return { open, setOpen, containerRef };
}
