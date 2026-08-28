'use client';

import { useEffect, useState } from 'react';
import { ArrowUpIcon } from './ArrowUpIcon';

const SCROLL_THRESHOLD = 400;

/**
 * Mobile-only (below `lg` the app shell scrolls at the window level, see src/app/layout.tsx's
 * body comment; at `lg` and up each page has its own internal scroll container instead).
 */
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="fixed right-4 bottom-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/90 text-white shadow-lg hover:bg-gray-900 lg:hidden dark:bg-gray-100/90 dark:text-gray-900 dark:hover:bg-gray-100"
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
}
