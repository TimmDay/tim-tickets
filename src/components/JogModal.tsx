'use client';

import { FormEvent, useState } from 'react';
import { useJogs } from '@/lib/JogsContext';
import { Jog } from '@/lib/types';

interface JogModalProps {
  jog?: Jog | null;
  onClose: () => void;
  onSaved: (jogId: string) => void;
}

export function JogModal({ jog, onClose, onSaved }: JogModalProps) {
  const { createJog, updateJog } = useJogs();
  const isEditing = Boolean(jog);

  const [name, setName] = useState(jog?.name ?? '');
  const [startDate, setStartDate] = useState(jog?.startDate ?? '');
  const [endDate, setEndDate] = useState(jog?.endDate ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await updateJog(jog!.id, name.trim(), startDate || null, endDate || null);
        onSaved(jog!.id);
      } else {
        const created = await createJog(name.trim(), startDate || null, endDate || null);
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
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{isEditing ? 'Edit jog' : 'New jog'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start date</label>
              <input
                type="date"
                value={startDate ?? ''}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End date</label>
              <input
                type="date"
                value={endDate ?? ''}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
