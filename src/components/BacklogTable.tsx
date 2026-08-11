'use client';

import { useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useJogs } from '@/lib/JogsContext';
import { ConfirmModal } from './ConfirmModal';
import { GripIcon } from './GripIcon';
import { JogModal } from './JogModal';
import { JogSelect } from './JogSelect';
import { TicketModal } from './TicketModal';
import { TrashIcon } from './TrashIcon';
import { STATUSES, Ticket } from '@/lib/types';

type SortKey = 'manual' | 'title' | 'jog' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function BacklogTable({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const [tickets, setTickets] = useState(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  const [search, setSearch] = useState('');
  const [jogFilter, setJogFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [showNewJog, setShowNewJog] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);

  const jogNameById = useMemo(() => new Map(jogs.map((jog) => [jog.id, jog.name])), [jogs]);
  const statusLabelByValue = useMemo(() => new Map(STATUSES.map((s) => [s.value, s.label])), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const canReorder = sortKey === 'manual' && !search.trim() && jogFilter === 'all';

  function toggleSort(key: Exclude<SortKey, 'manual'>) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  const visibleTickets = useMemo(() => {
    let result = tickets;

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((ticket) => ticket.title.toLowerCase().includes(query));
    }

    if (jogFilter !== 'all') {
      result = result.filter((ticket) => ticket.jogId === jogFilter);
    }

    const direction = sortDirection === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      if (sortKey === 'manual') return a.order - b.order;
      if (sortKey === 'title') return a.title.localeCompare(b.title) * direction;
      if (sortKey === 'jog') {
        const nameA = jogNameById.get(a.jogId) ?? '';
        const nameB = jogNameById.get(b.jogId) ?? '';
        return nameA.localeCompare(nameB) * direction;
      }
      return a.createdAt.localeCompare(b.createdAt) * direction;
    });

    return result;
  }, [tickets, search, jogFilter, sortKey, sortDirection, jogNameById]);

  async function handleReassign(ticketId: string, jogId: string) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, jogId } : t)));
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogId }),
    });
  }

  function handleSaved(ticket: Ticket) {
    setTickets((prev) =>
      prev.some((t) => t.id === ticket.id) ? prev.map((t) => (t.id === ticket.id ? ticket : t)) : [...prev, ticket],
    );
  }

  function handleDeleted(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }

  async function confirmDeleteTicket() {
    if (!deletingTicket) return;
    const id = deletingTicket.id;
    setDeletingTicket(null);
    handleDeleted(id);
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleTickets.findIndex((t) => t.id === active.id);
    const newIndex = visibleTickets.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(visibleTickets, oldIndex, newIndex).map((ticket, index) => ({
      ...ticket,
      order: index,
    }));

    setTickets(reordered);

    await fetch('/api/tickets/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: reordered.map((t) => t.id) }),
    });
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title…"
          className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={jogFilter}
          onChange={(event) => setJogFilter(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">All jogs</option>
          {jogs.map((jog) => (
            <option key={jog.id} value={jog.id}>
              {jog.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNewJog(true)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          New jog
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('title')}>
                Title {sortIndicator('title')}
              </th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('jog')}>
                Jog {sortIndicator('jog')}
              </th>
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('createdAt')}>
                Created {sortIndicator('createdAt')}
              </th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleTickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {visibleTickets.map((ticket) => (
                  <SortableTicketRow
                    key={ticket.id}
                    ticket={ticket}
                    disabled={!canReorder}
                    statusLabel={statusLabelByValue.get(ticket.status)}
                    onEdit={() => setEditingTicket(ticket)}
                    onDelete={() => setDeletingTicket(ticket)}
                    onReassign={(jogId) => handleReassign(ticket.id, jogId)}
                  />
                ))}
                {visibleTickets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                      No tickets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {editingTicket && (
        <TicketModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {showNewJog && <JogModal onClose={() => setShowNewJog(false)} onSaved={(jogId) => setJogFilter(jogId)} />}

      {deletingTicket && (
        <ConfirmModal
          title="Delete ticket"
          message={`Delete "${deletingTicket.title}"? This cannot be undone.`}
          onConfirm={confirmDeleteTicket}
          onCancel={() => setDeletingTicket(null)}
        />
      )}
    </div>
  );
}

interface SortableTicketRowProps {
  ticket: Ticket;
  disabled: boolean;
  statusLabel: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onReassign: (jogId: string) => void;
}

function SortableTicketRow({ ticket, disabled, statusLabel, onEdit, onDelete, onReassign }: SortableTicketRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    disabled,
  });

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
          className={`flex items-center justify-center ${
            disabled ? 'cursor-not-allowed text-gray-200' : 'cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing'
          }`}
          title={disabled ? 'Switch to default order (no search/filter) to reorder' : 'Drag to reorder'}
        >
          <GripIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={onEdit} className="text-left font-medium text-gray-900 hover:underline">
          {ticket.title}
        </button>
      </td>
      <td className="px-3 py-2 text-gray-600">{statusLabel}</td>
      <td className="px-3 py-2 text-gray-600 capitalize">{ticket.priority}</td>
      <td className="px-3 py-2">
        <JogSelect value={ticket.jogId} onChange={onReassign} className="w-48" />
      </td>
      <td className="px-3 py-2 text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</td>
      <td className="px-2 py-2 text-right">
        <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-600" aria-label="Delete ticket">
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
