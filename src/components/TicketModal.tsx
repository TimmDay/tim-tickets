'use client';

import { FormEvent, useState } from 'react';
import { JogSelect } from './JogSelect';
import { useJogs } from '@/lib/JogsContext';
import { PRIORITIES, Priority, Ticket } from '@/lib/types';

interface TicketModalProps {
  ticket?: Ticket | null;
  defaultJogId?: string;
  onClose: () => void;
  onSaved: (ticket: Ticket) => void;
  onDeleted?: (ticketId: string) => void;
}

export function TicketModal({ ticket, defaultJogId, onClose, onSaved, onDeleted }: TicketModalProps) {
  const { jogs } = useJogs();
  const isEditing = Boolean(ticket);

  const [title, setTitle] = useState(ticket?.title ?? '');
  const [body, setBody] = useState(ticket?.body ?? '');
  const [jogId, setJogId] = useState(ticket?.jogId ?? defaultJogId ?? jogs[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(ticket?.dueDate ?? '');
  const [tagsText, setTagsText] = useState((ticket?.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !jogId) return;
    setSaving(true);
    setError(null);

    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      body,
      jogId,
      priority,
      dueDate: dueDate || null,
      tags,
    };

    try {
      const response = await fetch(isEditing ? `/api/tickets/${ticket!.id}` : '/api/tickets', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save ticket');

      const saved: Ticket = isEditing
        ? { ...(ticket as Ticket), ...payload, updatedAt: new Date().toISOString() }
        : await response.json();

      onSaved(saved);
      onClose();
    } catch {
      setError('Something went wrong saving this ticket.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    if (!window.confirm('Delete this ticket?')) return;
    setSaving(true);
    try {
      await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
      onDeleted?.(ticket.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit ticket' : 'New ticket'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jog</label>
              <JogSelect value={jogId} onChange={setJogId} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
              <input
                type="date"
                value={dueDate ?? ''}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tags</label>
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="comma, separated"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
