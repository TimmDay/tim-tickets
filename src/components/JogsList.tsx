'use client';

import { useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useJogs } from '@/lib/JogsContext';
import { computeReorder } from '@/lib/ordering';
import { ConfirmModal } from './ConfirmModal';
import { FilterInput } from './FilterInput';
import { GripIcon } from './GripIcon';
import { JogModal } from './JogModal';
import { PencilIcon } from './PencilIcon';
import { TrashIcon } from './TrashIcon';
import { Jog } from '@/lib/types';

interface JogsListProps {
  ticketCounts: Record<string, number>;
}

export function JogsList({ ticketCounts }: JogsListProps) {
  const { jogs, defaultJogId, deleteJog, reorderJogs, updateJogOrder, completeJog } = useJogs();
  const [editingJog, setEditingJog] = useState<Jog | null>(null);
  const [deletingJog, setDeletingJog] = useState<Jog | null>(null);
  const [completingJog, setCompletingJog] = useState<Jog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNewJog, setShowNewJog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterText, setFilterText] = useState('');

  const displayedJogs = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return jogs
      .filter((jog) => showArchived || !jog.isArchived)
      .filter((jog) => !query || jog.name.toLowerCase().includes(query))
      .sort((a, b) => a.order - b.order);
  }, [jogs, showArchived, filterText]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayedJogs.findIndex((jog) => jog.id === active.id);
    const newIndex = displayedJogs.findIndex((jog) => jog.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(displayedJogs, oldIndex, newIndex);
    const { persist } = computeReorder(moved, active.id as string);

    if (persist.kind === 'bulk') {
      await reorderJogs(persist.orderedIds);
    } else {
      await updateJogOrder(persist.id, persist.order);
    }
  }

  async function confirmDelete() {
    if (!deletingJog) return;
    const jog = deletingJog;
    setDeletingJog(null);
    try {
      await deleteJog(jog.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete jog');
    }
  }

  async function confirmComplete() {
    if (!completingJog) return;
    const jog = completingJog;
    setCompletingJog(null);
    try {
      await completeJog(jog.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete jog');
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
          onClick={() => setShowNewJog(true)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          New jog
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
        <FilterInput value={filterText} onChange={setFilterText} placeholder="Filter Jogs by title…" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* Desktop: table with drag-reorder */}
        <div className="hidden rounded-lg border border-gray-200 lg:block dark:border-gray-800">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Start date</th>
                  <th className="px-3 py-2 font-medium">End date</th>
                  <th className="px-3 py-2 font-medium">Tickets</th>
                  <th className="px-3 py-2 font-medium" />
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <SortableContext items={displayedJogs.map((jog) => jog.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {displayedJogs.map((jog) => (
                    <SortableJogRow
                      key={jog.id}
                      jog={jog}
                      isDefault={jog.id === defaultJogId}
                      ticketCount={ticketCounts[jog.id] ?? 0}
                      onEdit={() => setEditingJog(jog)}
                      onDelete={() => setDeletingJog(jog)}
                      onComplete={() => setCompletingJog(jog)}
                    />
                  ))}
                  {displayedJogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-400 dark:text-gray-500">
                        No jogs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>

        {/* Mobile: scrollable list of cards, no drag-reorder */}
        <div className="space-y-2 lg:hidden">
          {displayedJogs.map((jog) => (
            <JogCard
              key={jog.id}
              jog={jog}
              isDefault={jog.id === defaultJogId}
              ticketCount={ticketCounts[jog.id] ?? 0}
              onEdit={() => setEditingJog(jog)}
              onDelete={() => setDeletingJog(jog)}
              onComplete={() => setCompletingJog(jog)}
            />
          ))}
          {displayedJogs.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No jogs yet.</p>
          )}
        </div>
      </div>

      {editingJog && <JogModal jog={editingJog} onClose={() => setEditingJog(null)} onSaved={() => {}} />}

      {showNewJog && <JogModal onClose={() => setShowNewJog(false)} onSaved={() => {}} />}

      {deletingJog && (
        <ConfirmModal
          title="Delete jog"
          message={`Delete "${deletingJog.name}"? Any tickets in it will move to Default Jog. This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingJog(null)}
        />
      )}

      {completingJog && (
        <ConfirmModal
          title="Complete jog"
          message={`Completing "${completingJog.name}" will archive it, and automatically archive all tasks within it that are in the DONE column. All tasks in other columns will be removed from this jog and put into the backlog (default jog). You can view this archived jog in future by checking the show archived box on the jogs page.`}
          confirmLabel="Complete"
          onConfirm={confirmComplete}
          onCancel={() => setCompletingJog(null)}
        />
      )}
    </div>
  );
}

interface SortableJogRowProps {
  jog: Jog;
  isDefault: boolean;
  ticketCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}

function SortableJogRow({ jog, isDefault, ticketCount, onEdit, onDelete, onComplete }: SortableJogRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jog.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60 ${isDragging ? 'opacity-50' : ''}`}
    >
      <td className="px-2 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-300"
          title="Drag to reorder"
        >
          <GripIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2 font-medium">
        <Link
          href={`/?jogId=${jog.id}`}
          title="View on Current Jog board"
          className={`hover:underline ${
            jog.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {jog.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{jog.startDate ?? '—'}</td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{jog.endDate ?? '—'}</td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{ticketCount}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-gray-600 hover:underline dark:text-gray-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={isDefault || jog.isArchived}
            title={isDefault ? "Can't complete the default jog" : jog.isArchived ? 'Already archived' : undefined}
            className={`text-sm ${
              isDefault || jog.isArchived
                ? 'cursor-not-allowed text-gray-300 dark:text-gray-700'
                : 'text-gray-600 hover:underline dark:text-gray-400'
            }`}
          >
            Complete
          </button>
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={isDefault}
          title={isDefault ? "Can't delete the default jog" : undefined}
          className={`text-gray-400 dark:text-gray-500 ${
            isDefault ? 'cursor-not-allowed opacity-30' : 'hover:text-red-600 dark:hover:text-red-400'
          }`}
          aria-label="Delete jog"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

interface JogCardProps {
  jog: Jog;
  isDefault: boolean;
  ticketCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}

function JogCard({ jog, isDefault, ticketCount, onEdit, onDelete, onComplete }: JogCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/?jogId=${jog.id}`}
          title="View on Current Jog board"
          className={`text-left text-sm font-medium hover:underline ${
            jog.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {jog.name}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Edit jog"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDefault}
            title={isDefault ? "Can't delete the default jog" : undefined}
            className={
              isDefault
                ? 'cursor-not-allowed text-gray-400 opacity-30 dark:text-gray-500'
                : 'text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400'
            }
            aria-label="Delete jog"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
        {(jog.startDate || jog.endDate) && (
          <span>
            {jog.startDate ?? '…'} → {jog.endDate ?? '…'}
          </span>
        )}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {ticketCount} ticket{ticketCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={isDefault || jog.isArchived}
          title={isDefault ? "Can't complete the default jog" : jog.isArchived ? 'Already archived' : undefined}
          className={`text-sm ${
            isDefault || jog.isArchived
              ? 'cursor-not-allowed text-gray-300 dark:text-gray-700'
              : 'text-gray-600 hover:underline dark:text-gray-400'
          }`}
        >
          Complete
        </button>
      </div>
    </div>
  );
}
