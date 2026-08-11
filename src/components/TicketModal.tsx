'use client';

import { FormEvent, useState } from 'react';
import { JogSelect } from './JogSelect';
import { useJogs } from '@/lib/JogsContext';
import { Comment, PRIORITIES, Priority, Ticket } from '@/lib/types';

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

  const [comments, setComments] = useState<Comment[]>(ticket?.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

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
        ? { ...(ticket as Ticket), ...payload, comments, updatedAt: new Date().toISOString() }
        : await response.json();

      onSaved(saved);
      onClose();
    } catch {
      setError('Something went wrong saving this ticket.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    const body = newComment.trim();
    if (!body || !ticket) return;
    setAddingComment(true);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const comment: Comment = await response.json();
      const updatedComments = [...comments, comment];
      setComments(updatedComments);
      setNewComment('');
      onSaved({ ...ticket, comments: updatedComments });
    } finally {
      setAddingComment(false);
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit ticket' : 'New ticket'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Jog</label>
              <JogSelect value={jogId} onChange={setJogId} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Due date</label>
              <input
                type="date"
                value={dueDate ?? ''}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="comma, separated"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {isEditing && (
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Comments</h3>
            <ul className="mb-2 max-h-40 space-y-2 overflow-y-auto">
              {comments.length === 0 && <li className="text-sm text-gray-400 dark:text-gray-500">No comments yet.</li>}
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-800">
                  <p className="text-gray-800 dark:text-gray-200">{comment.body}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="Add a comment…"
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={addingComment || !newComment.trim()}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
