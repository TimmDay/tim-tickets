'use client';

import { Epic, getEpicColorTheme } from '@/lib/types';
import { useTapTooltip } from '@/lib/useTapTooltip';

interface EpicChipProps {
  epic: Epic;
  className?: string;
}

export function EpicChip({ epic, className }: EpicChipProps) {
  const theme = getEpicColorTheme(epic.colorTheme);
  const { open, setOpen, containerRef } = useTapTooltip<HTMLSpanElement>();

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(event) => {
        if (!epic.description) return;
        event.stopPropagation();
        setOpen((prev) => !prev);
      }}
    >
      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${theme.chipClassName}`}>{epic.name}</span>
      {epic.description && (
        <span
          className={`pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 w-48 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg transition-opacity dark:bg-gray-700 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {epic.description}
        </span>
      )}
    </span>
  );
}
