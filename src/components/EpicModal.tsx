'use client';

import { SubmitEvent, useEffect, useState } from 'react';
import { EpicColorThemeSelect } from './EpicColorThemeSelect';
import { XIcon } from './XIcon';
import { useEpics } from '@/lib/EpicsContext';
import { useNewEpicDraft } from '@/lib/formDrafts';
import { parseGithubRepoUrl } from '@/lib/github';
import { DEFAULT_EPIC_COLOR_THEME, Epic } from '@/lib/types';

interface EpicModalProps {
  epic?: Epic | null;
  onClose: () => void;
  onSaved: (epicId: string) => void;
}

export function EpicModal({ epic, onClose, onSaved }: EpicModalProps) {
  const { createEpic, updateEpic } = useEpics();
  const isEditing = Boolean(epic);
  const { getDraft, setDraft, clearDraft } = useNewEpicDraft();
  const draft = isEditing ? null : getDraft();

  const [name, setName] = useState(epic?.name ?? draft?.name ?? '');
  const [description, setDescription] = useState(epic?.description ?? draft?.description ?? '');
  const [colorTheme, setColorTheme] = useState(epic?.colorTheme ?? draft?.colorTheme ?? DEFAULT_EPIC_COLOR_THEME);
  const [repoUrl, setRepoUrl] = useState(epic?.repoUrl ?? draft?.repoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const repoUrlInvalid = Boolean(repoUrl.trim()) && !parseGithubRepoUrl(repoUrl);

  useEffect(() => {
    if (isEditing) return;
    setDraft({ name, description, colorTheme, repoUrl });
  }, [isEditing, name, description, colorTheme, repoUrl, setDraft]);

  function handleCancel() {
    clearDraft();
    onClose();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim() || repoUrlInvalid) return;
    setSaving(true);
    const repoUrlValue = repoUrl.trim() || null;
    try {
      if (isEditing) {
        await updateEpic(epic!.id, name.trim(), description, colorTheme, repoUrlValue);
        onSaved(epic!.id);
      } else {
        const created = await createEpic(name.trim(), description, colorTheme, repoUrlValue);
        clearDraft();
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
        className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <XIcon className="h-5 w-5" />
        </button>
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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub repo</label>
            <input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="Optional — https://github.com/owner/repo"
              aria-invalid={repoUrlInvalid}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {repoUrlInvalid && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Must be a GitHub repo URL, e.g. https://github.com/owner/repo</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || repoUrlInvalid}
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
