'use client';

import { useState } from 'react';
import { useEpics } from '@/lib/EpicsContext';
import { Epic } from '@/lib/types';

interface EpicSelectProps {
  value: string | null;
  onChange: (epicId: string | null) => void;
  className?: string;
  includeArchived?: boolean;
}

export function EpicSelect({ value, onChange, className, includeArchived = false }: EpicSelectProps) {
  const { epics, createEpic } = useEpics();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Same rationale as JogSelect: look up the trigger label against the full list so an
  // archived epic still shows its name, but only offer non-archived epics as new targets.
  const selected = epics.find((epic) => epic.id === value);
  const selectableEpics = epics.filter((epic) => includeArchived || !epic.isArchived);

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
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {selected?.name ?? 'No epic'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeAndReset} />
          <div className="absolute z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
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
