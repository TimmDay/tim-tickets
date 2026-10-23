'use client';

import { useState } from 'react';
import { TargetIcon } from './TargetIcon';
import { Jog } from '@/lib/types';

/** Target button sitting left of the board's jog select; clicking it shows the jog's goal. */
export function JogGoalPopover({ jog }: { jog: Jog }) {
  const [open, setOpen] = useState(false);
  const hasGoal = jog.goal.trim() !== '';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Show jog goal"
        aria-expanded={open}
        title="Jog goal"
        className={`rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 ${
          hasGoal
            ? 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
            : 'text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400'
        }`}
      >
        <TargetIcon className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Jog goal
            </div>
            {hasGoal ? (
              <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">{jog.goal}</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No goal set. Add one by editing the jog on the Jogs page.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
