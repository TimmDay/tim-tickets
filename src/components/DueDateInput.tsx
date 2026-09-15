'use client';

import { XIcon } from './XIcon';

interface DueDateInputProps {
  /** `YYYY-MM-DD`, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
}

function formatDueDate(value: string): string {
  // Parse as a local date — `new Date('2026-09-16')` would be UTC midnight and can show the
  // previous day in negative-offset timezones.
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Due date field styled like EpicSelect's trigger button. A native <input type="date"> would
 * look different (and on mobile globals.css floors it at 16px), so the visible button is just a
 * label: a transparent native date input sits on top of it to receive the tap/click and open the
 * platform's own date picker — no custom calendar to build or maintain.
 */
export function DueDateInput({ value, onChange }: DueDateInputProps) {
  return (
    <div className="relative">
      <div
        className={`w-full truncate rounded-md border border-gray-300 bg-white py-1.5 pl-3 text-left text-sm dark:border-gray-600 dark:bg-gray-800 ${
          value ? 'pr-8 text-gray-900 dark:text-gray-100' : 'pr-3 text-gray-500 dark:text-gray-400'
        }`}
      >
        {value ? formatDueDate(value) : 'No due date'}
      </div>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Desktop Chrome/Firefox only open the picker from the calendar icon, not a click on the
        // (invisible) text — so open it explicitly. Mobile browsers open it on tap regardless.
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // showPicker unsupported or not allowed here — the native tap behaviour still applies.
          }
        }}
        aria-label="Due date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear due date"
          className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
