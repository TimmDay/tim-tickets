'use client';

import { useRef, useState } from 'react';
import { useEpics } from '@/lib/EpicsContext';
import { Epic } from '@/lib/types';

interface EpicSelectProps {
  value: string | null;
  onChange: (epicId: string | null) => void;
  className?: string;
  includeArchived?: boolean;
}

// Rough max height of the open dropdown (option list + "+ New Epic" footer) — used to decide
// whether it should open upward instead of downward so it doesn't render off the bottom of
// the viewport, e.g. when the field sits near the bottom of the ticket modal on mobile.
const DROPDOWN_HEIGHT_ESTIMATE = 260;

export function EpicSelect({ value, onChange, className, includeArchived = false }: EpicSelectProps) {
  const { epics, createEpic } = useEpics();
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Same rationale as JogSelect: look up the trigger label against the full list so an
  // archived epic still shows its name, but only offer non-archived epics as new targets.
  const selected = epics.find((epic) => epic.id === value);
  const selectableEpics = epics.filter((epic) => includeArchived || !epic.isArchived);

  function toggleOpen() {
    if (!open) {
      const spaceBelow = triggerRef.current
        ? window.innerHeight - triggerRef.current.getBoundingClientRect().bottom
        : Infinity;
      setOpenUpward(spaceBelow < DROPDOWN_HEIGHT_ESTIMATE);
    }
    setOpen((prev) => !prev);
  }

  function closeAndReset() {
    setOpen(false);
    setAdding(false);
    setNewName('');
  }

  function selectEpic(epic: Epic | null) {
    onChange(epic?.id ?? null);
    closeAndReset();
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const epic = await createEpic(name);
    onChange(epic.id);
    closeAndReset();
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="w-full truncate rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {selected?.name ?? 'No epic'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeAndReset} />
          <div
            className={`absolute z-20 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
              openUpward ? 'bottom-full mb-1' : 'mt-1'
            }`}
          >
            <ul className="max-h-48 overflow-auto">
              <li>
                <button
                  type="button"
                  onClick={() => selectEpic(null)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    value === null
                      ? 'font-medium text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  No epic
                </button>
              </li>
              {selectableEpics.map((epic) => (
                <li key={epic.id}>
                  <button
                    type="button"
                    onClick={() => selectEpic(epic)}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      epic.id === value
                        ? 'font-medium text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {epic.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 p-2 dark:border-gray-700">
              {adding ? (
                <div className="space-y-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCreate();
                      }
                    }}
                    placeholder="Epic name"
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full rounded bg-gray-900 px-2 py-1 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full rounded px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  + New Epic
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
