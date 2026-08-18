'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useEpics } from '@/lib/EpicsContext';
import { ConfirmModal } from './ConfirmModal';
import { EpicModal } from './EpicModal';
import { FilterInput } from './FilterInput';
import { PencilIcon } from './PencilIcon';
import { TrashIcon } from './TrashIcon';
import { ALL_JOGS_ID, Epic, getEpicColorTheme } from '@/lib/types';

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

interface EpicsListProps {
  ticketCounts: Record<string, number>;
}

export function EpicsList({ ticketCounts }: EpicsListProps) {
  const { epics, deleteEpic, archiveEpic } = useEpics();
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [deletingEpic, setDeletingEpic] = useState<Epic | null>(null);
  const [archivingEpic, setArchivingEpic] = useState<Epic | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNewEpic, setShowNewEpic] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterText, setFilterText] = useState('');

  const displayedEpics = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return epics
      .filter((epic) => showArchived || !epic.isArchived)
      .filter((epic) => !query || epic.name.toLowerCase().includes(query))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [epics, showArchived, filterText]);

  async function confirmDelete() {
    if (!deletingEpic) return;
    const epic = deletingEpic;
    setDeletingEpic(null);
    try {
      await deleteEpic(epic.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete epic');
    }
  }

  async function confirmArchive() {
    if (!archivingEpic) return;
    const epic = archivingEpic;
    setArchivingEpic(null);
    try {
      await archiveEpic(epic.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive epic');
    }
  }

  return (
    <div className="flex h-full flex-col">
      {actionError && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowNewEpic(true)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          New epic
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="tt-checkbox"
          />
          Show archived
        </label>
        <FilterInput value={filterText} onChange={setFilterText} placeholder="Filter Epics by name…" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* Desktop: table */}
        <div className="hidden rounded-lg border border-gray-200 lg:block dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Completed</th>
                <th className="px-3 py-2 font-medium">Tickets</th>
                <th className="px-3 py-2 font-medium" />
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {displayedEpics.map((epic) => (
                <EpicRow
                  key={epic.id}
                  epic={epic}
                  ticketCount={ticketCounts[epic.id] ?? 0}
                  onEdit={() => setEditingEpic(epic)}
                  onDelete={() => setDeletingEpic(epic)}
                  onArchive={() => setArchivingEpic(epic)}
                />
              ))}
              {displayedEpics.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-400 dark:text-gray-500">
                    No epics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: scrollable list of cards */}
        <div className="space-y-2 lg:hidden">
          {displayedEpics.map((epic) => (
            <EpicCard
              key={epic.id}
              epic={epic}
              ticketCount={ticketCounts[epic.id] ?? 0}
              onEdit={() => setEditingEpic(epic)}
              onDelete={() => setDeletingEpic(epic)}
              onArchive={() => setArchivingEpic(epic)}
            />
          ))}
          {displayedEpics.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No epics yet.</p>
          )}
        </div>
      </div>

      {editingEpic && <EpicModal epic={editingEpic} onClose={() => setEditingEpic(null)} onSaved={() => {}} />}

      {showNewEpic && <EpicModal onClose={() => setShowNewEpic(false)} onSaved={() => {}} />}

      {deletingEpic && (
        <ConfirmModal
          title="Delete epic"
          message={`Delete "${deletingEpic.name}"? Tickets in it will lose their epic assignment. This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEpic(null)}
        />
      )}

      {archivingEpic && (
        <ConfirmModal
          title="Archive epic"
          message={`Archiving "${archivingEpic.name}" will archive it and ALL tickets assigned to it, regardless of status. You can view this archived epic in future by checking the show archived box on the epics page.`}
          confirmLabel="Archive"
          onConfirm={confirmArchive}
          onCancel={() => setArchivingEpic(null)}
        />
      )}
    </div>
  );
}

interface EpicRowProps {
  epic: Epic;
  ticketCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function EpicRow({ epic, ticketCount, onEdit, onDelete, onArchive }: EpicRowProps) {
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
      <td className="px-3 py-2 font-medium">
        <Link
          href={`/?jogId=${ALL_JOGS_ID}&epicId=${epic.id}`}
          title="View on Current Jog board"
          className={`inline-flex items-center gap-1.5 hover:underline ${
            epic.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getEpicColorTheme(epic.colorTheme).dotClassName}`} />
          {epic.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{formatDate(epic.createdAt)}</td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{formatDate(epic.startedAt)}</td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{formatDate(epic.completedAt)}</td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{ticketCount}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onEdit} className="text-sm text-gray-600 hover:underline dark:text-gray-400">
            Edit
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={epic.isArchived}
            title={epic.isArchived ? 'Already archived' : undefined}
            className={`text-sm ${
              epic.isArchived
                ? 'cursor-not-allowed text-gray-300 dark:text-gray-700'
                : 'text-gray-600 hover:underline dark:text-gray-400'
            }`}
          >
            Archive
          </button>
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
          aria-label="Delete epic"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

interface EpicCardProps {
  epic: Epic;
  ticketCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function EpicCard({ epic, ticketCount, onEdit, onDelete, onArchive }: EpicCardProps) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!descriptionOpen) return;
    // Mirrors EpicChip's tap-tooltip behavior: mobile browsers hold the tap-simulated :hover
    // state open until the next tap, so close on scroll or an outside tap rather than leaving
    // it pinned in place while the page scrolls underneath it.
    function handleScroll() {
      setDescriptionOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (descriptionRef.current && !descriptionRef.current.contains(event.target as Node)) {
        setDescriptionOpen(false);
      }
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [descriptionOpen]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/?jogId=${ALL_JOGS_ID}&epicId=${epic.id}`}
            title="View on Current Jog board"
            className={`inline-flex items-center gap-1.5 text-left text-sm font-medium hover:underline ${
              epic.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getEpicColorTheme(epic.colorTheme).dotClassName}`} />
            {epic.name}
          </Link>
          {epic.description && (
            <span
              ref={descriptionRef}
              className="relative shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                setDescriptionOpen((prev) => !prev);
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                ⓘ
              </span>
              <span
                className={`pointer-events-none absolute top-full left-0 z-20 mt-1.5 w-48 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg transition-opacity dark:bg-gray-700 ${
                  descriptionOpen ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {epic.description}
              </span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Edit epic"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            aria-label="Delete epic"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {ticketCount} ticket{ticketCount === 1 ? '' : 's'}
        </span>
        <span>Started {formatDate(epic.startedAt)}</span>
        <span>Completed {formatDate(epic.completedAt)}</span>
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onArchive}
          disabled={epic.isArchived}
          title={epic.isArchived ? 'Already archived' : undefined}
          className={`text-sm ${
            epic.isArchived
              ? 'cursor-not-allowed text-gray-300 dark:text-gray-700'
              : 'text-gray-600 hover:underline dark:text-gray-400'
          }`}
        >
          Archive
        </button>
      </div>
    </div>
  );
}
