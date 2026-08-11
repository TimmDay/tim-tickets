'use client';

import { useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useJogs } from '@/lib/JogsContext';
import { ConfirmModal } from './ConfirmModal';
import { GripIcon } from './GripIcon';
import { JogModal } from './JogModal';
import { TrashIcon } from './TrashIcon';
import { Jog } from '@/lib/types';

export function JogsList() {
  const { jogs, deleteJog, reorderJogs } = useJogs();
  const [editingJog, setEditingJog] = useState<Jog | null>(null);
  const [deletingJog, setDeletingJog] = useState<Jog | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sortedJogs = useMemo(() => [...jogs].sort((a, b) => a.order - b.order), [jogs]);
  const defaultJogId = useMemo(
    () => jogs.reduce((earliest, jog) => (jog.createdAt < earliest.createdAt ? jog : earliest), jogs[0])?.id,
    [jogs],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedJogs.findIndex((jog) => jog.id === active.id);
    const newIndex = sortedJogs.findIndex((jog) => jog.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedJogs, oldIndex, newIndex);
    await reorderJogs(reordered.map((jog) => jog.id));
  }

  async function confirmDelete() {
    if (!deletingJog) return;
    const jog = deletingJog;
    setDeletingJog(null);
    try {
      await deleteJog(jog.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete jog');
    }
  }

  return (
    <div className="flex h-full flex-col">
      {deleteError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Start date</th>
              <th className="px-3 py-2 font-medium">End date</th>
              <th className="px-3 py-2 font-medium" />
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedJogs.map((jog) => jog.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sortedJogs.map((jog) => (
                  <SortableJogRow
                    key={jog.id}
                    jog={jog}
                    isDefault={jog.id === defaultJogId}
                    onEdit={() => setEditingJog(jog)}
                    onDelete={() => setDeletingJog(jog)}
                  />
                ))}
                {sortedJogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                      No jogs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {editingJog && <JogModal jog={editingJog} onClose={() => setEditingJog(null)} onSaved={() => {}} />}

      {deletingJog && (
        <ConfirmModal
          title="Delete jog"
          message={`Delete "${deletingJog.name}"? Any tickets in it will move to Default Jog. This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingJog(null)}
        />
      )}
    </div>
  );
}

interface SortableJogRowProps {
  jog: Jog;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableJogRow({ jog, isDefault, onEdit, onDelete }: SortableJogRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jog.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${isDragging ? 'opacity-50' : ''}`}
    >
      <td className="px-2 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2 font-medium text-gray-900">{jog.name}</td>
      <td className="px-3 py-2 text-gray-500">{jog.startDate ?? '—'}</td>
      <td className="px-3 py-2 text-gray-500">{jog.endDate ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <button type="button" onClick={onEdit} className="text-sm text-gray-600 hover:underline">
          Edit
        </button>
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={isDefault}
          title={isDefault ? "Can't delete the default jog" : undefined}
          className={`text-gray-400 ${isDefault ? 'cursor-not-allowed opacity-30' : 'hover:text-red-600'}`}
          aria-label="Delete jog"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
