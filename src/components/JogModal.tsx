'use client';

import { SubmitEvent, useEffect, useState } from 'react';
import { useJogs } from '@/lib/JogsContext';
import { clearDraft, getDraft, setDraft } from '@/lib/formDrafts';
import { Jog } from '@/lib/types';

interface JogModalProps {
  jog?: Jog | null;
  onClose: () => void;
  onSaved: (jogId: string) => void;
}

const NEW_JOG_DRAFT_KEY = 'jog:new';

interface NewJogDraft {
  name: string;
  startDate: string;
  endDate: string;
}

export function JogModal({ jog, onClose, onSaved }: JogModalProps) {
  const { createJog, updateJog } = useJogs();
  const isEditing = Boolean(jog);
  const draft = isEditing ? undefined : getDraft<NewJogDraft>(NEW_JOG_DRAFT_KEY);

  const [name, setName] = useState(jog?.name ?? draft?.name ?? '');
  const [startDate, setStartDate] = useState(jog?.startDate ?? draft?.startDate ?? '');
  const [endDate, setEndDate] = useState(jog?.endDate ?? draft?.endDate ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    setDraft<NewJogDraft>(NEW_JOG_DRAFT_KEY, { name, startDate, endDate });
  }, [isEditing, name, startDate, endDate]);

  function handleCancel() {
    clearDraft(NEW_JOG_DRAFT_KEY);
    onClose();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await updateJog(jog!.id, name.trim(), startDate || null, endDate || null);
        onSaved(jog!.id);
      } else {
        const created = await createJog(name.trim(), startDate || null, endDate || null);
        clearDraft(NEW_JOG_DRAFT_KEY);
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
          {isEditing ? 'Edit jog' : 'New jog'}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start date</label>
              <input
                type="date"
                value={startDate ?? ''}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">End date</label>
              <input
                type="date"
                value={endDate ?? ''}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
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
