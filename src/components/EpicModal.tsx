'use client';

import { SubmitEvent, useState } from 'react';
import { EpicColorThemeSelect } from './EpicColorThemeSelect';
import { useEpics } from '@/lib/EpicsContext';
import { DEFAULT_EPIC_COLOR_THEME, Epic } from '@/lib/types';

interface EpicModalProps {
  epic?: Epic | null;
  onClose: () => void;
  onSaved: (epicId: string) => void;
}

export function EpicModal({ epic, onClose, onSaved }: EpicModalProps) {
  const { createEpic, updateEpic } = useEpics();
  const isEditing = Boolean(epic);

  const [name, setName] = useState(epic?.name ?? '');
  const [description, setDescription] = useState(epic?.description ?? '');
  const [colorTheme, setColorTheme] = useState(epic?.colorTheme ?? DEFAULT_EPIC_COLOR_THEME);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await updateEpic(epic!.id, name.trim(), description, colorTheme);
        onSaved(epic!.id);
      } else {
        const created = await createEpic(name.trim(), description, colorTheme);
        onSaved(created.id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit epic' : 'New epic'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional — shown as a tooltip on the epic chip"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
            <EpicColorThemeSelect value={colorTheme} onChange={setColorTheme} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving ? 'Saving…' : isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
