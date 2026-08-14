'use client';

import { useState } from 'react';
import { EPIC_COLOR_THEMES, EpicColorTheme, getEpicColorTheme } from '@/lib/types';

interface EpicColorThemeSelectProps {
  value: EpicColorTheme;
  onChange: (colorTheme: EpicColorTheme) => void;
}

export function EpicColorThemeSelect({ value, onChange }: EpicColorThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = getEpicColorTheme(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left dark:border-gray-600 dark:bg-gray-800"
      >
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${selected.chipClassName}`}>
          {selected.label}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <ul>
              {EPIC_COLOR_THEMES.map((theme) => (
                <li key={theme.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(theme.value);
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${theme.chipClassName}`}>
                      {theme.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
