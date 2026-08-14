'use client';

import { SubmitEvent, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from './ChevronDownIcon';
import { ConfirmModal } from './ConfirmModal';
import { EpicSelect } from './EpicSelect';
import { InfoIcon } from './InfoIcon';
import { JogSelect } from './JogSelect';
import { TagChip, TagInput } from './TagInput';
import { XIcon } from './XIcon';
import { useJogs } from '@/lib/JogsContext';
import { BASE_TAGS, Comment, PRIORITIES, Priority, STATUSES, Ticket, TicketStatus } from '@/lib/types';

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
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(ticket?.acceptanceCriteria ?? '');
  const acceptanceCriteriaRef = useRef<HTMLTextAreaElement>(null);
  const [jogId, setJogId] = useState(ticket?.jogId ?? defaultJogId ?? jogs[0]?.id ?? '');
  const [epicId, setEpicId] = useState<string | null>(ticket?.epicId ?? null);
  const [priority, setPriority] = useState<Priority | null>(ticket?.priority ?? null);
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(ticket?.dueDate ?? '');
  const [tags, setTags] = useState<string[]>(ticket?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>(ticket?.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);

  useEffect(() => {
    const el = acceptanceCriteriaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [acceptanceCriteria]);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim() || !jogId) return;
    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      body,
      acceptanceCriteria,
      jogId,
      epicId,
      priority,
      status,
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

  async function confirmDeleteComment() {
    if (!deletingComment || !ticket) return;
    const commentId = deletingComment.id;
    setDeletingComment(null);
    const updatedComments = comments.filter((comment) => comment.id !== commentId);
    setComments(updatedComments);
    onSaved({ ...ticket, comments: updatedComments });
    await fetch(`/api/tickets/${ticket.id}/comments/${commentId}`, { method: 'DELETE' });
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

  async function handleToggleArchive() {
    if (!ticket) return;
    setSaving(true);
    try {
      const nextArchived = !ticket.isArchived;
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      onSaved({ ...ticket, isArchived: nextArchived });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div
        className="h-dvh w-full overflow-y-auto bg-white px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg sm:pb-6 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit ticket' : 'New ticket'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {isEditing && (
            <div className="lg:hidden">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TicketStatus)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
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
                  rows={10}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Acceptance Criteria
                  </label>
                  <button
                    type="button"
                    tabIndex={0}
                    aria-label="What is Acceptance Criteria?"
                    className="group relative inline-flex text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <InfoIcon className="h-3.5 w-3.5" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-gray-700">
                      One per line. Each line should be a concrete, testable condition — for a dev task, think of
                      each line as a test someone could check off.
                    </span>
                  </button>
                </div>
                <textarea
                  ref={acceptanceCriteriaRef}
                  value={acceptanceCriteria}
                  onChange={(event) => setAcceptanceCriteria(event.target.value)}
                  rows={3}
                  placeholder={'e.g.\n- [ ] GIVEN x WHEN y THEN z\n- [ ] returns 400 bad Request if email field is missing'}
                  className="w-full resize-none overflow-hidden rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="space-y-3 lg:col-span-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Jog</label>
                <JogSelect value={jogId} onChange={setJogId} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Epic</label>
                <EpicSelect value={epicId} onChange={setEpicId} />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
                  {tags.map((tag) => (
                    <TagChip key={tag} tag={tag} onRemove={() => setTags(tags.filter((t) => t !== tag))} />
                  ))}
                </div>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  options={BASE_TAGS}
                  placeholder="Type to search or add a tag…"
                  showChips={false}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <div className="relative">
                  <select
                    value={priority ?? ''}
                    onChange={(event) =>
                      setPriority(event.target.value === '' ? null : (event.target.value as Priority))
                    }
                    className="w-full appearance-none rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">No priority</option>
                    {PRIORITIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Due date</label>
                <input
                  type="date"
                  value={dueDate ?? ''}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleArchive}
                    disabled={saving}
                    className="text-sm text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-400"
                  >
                    {ticket?.isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-sm text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-400"
                  >
                    Delete
                  </button>
                </>
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
                <li key={comment.id} className="relative rounded-md bg-gray-50 p-2 pr-7 text-sm dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setDeletingComment(comment)}
                    aria-label="Delete comment"
                    className="absolute top-1.5 right-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
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

      {deletingComment && (
        <div onClick={(event) => event.stopPropagation()}>
          <ConfirmModal
            title="Delete comment"
            message="Delete this comment? This cannot be undone."
            onConfirm={confirmDeleteComment}
            onCancel={() => setDeletingComment(null)}
          />
        </div>
      )}
    </div>
  );
}
