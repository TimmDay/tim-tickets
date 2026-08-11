'use client';

import { useState } from 'react';
import { useJogs } from '@/lib/JogsContext';
import { Jog } from '@/lib/types';

interface JogSelectProps {
  value: string;
  onChange: (jogId: string) => void;
  className?: string;
}

export function JogSelect({ value, onChange, className }: JogSelectProps) {
  const { jogs, createJog } = useJogs();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const selected = jogs.find((jog) => jog.id === value);

  function closeAndReset() {
    setOpen(false);
    setAdding(false);
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
  }

  function selectJog(jog: Jog) {
    onChange(jog.id);
    closeAndReset();
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const jog = await createJog(name, newStartDate || null, newEndDate || null);
    onChange(jog.id);
    closeAndReset();
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {selected?.name ?? 'Select jog'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeAndReset} />
          <div className="absolute z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <ul className="max-h-48 overflow-auto">
              {jogs.map((jog) => (
                <li key={jog.id}>
                  <button
                    type="button"
                    onClick={() => selectJog(jog)}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      jog.id === value
                        ? 'font-medium text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {jog.name}
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
                    placeholder="Jog name"
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(event) => setNewStartDate(event.target.value)}
                      title="Start date (optional)"
                      className="w-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    />
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(event) => setNewEndDate(event.target.value)}
                      title="End date (optional)"
                      className="w-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    />
                  </div>
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
                  + New Jog
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
