'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEpics } from '@/lib/EpicsContext';
import { useJogs } from '@/lib/JogsContext';
import { computeOrderBetween, needsRebalance } from '@/lib/ordering';
import { ArchiveIcon } from './ArchiveIcon';
import { ChevronDownIcon } from './ChevronDownIcon';
import { ConfirmModal } from './ConfirmModal';
import { EpicChip } from './EpicChip';
import { FilterInput } from './FilterInput';
import { GripIcon } from './GripIcon';
import { JogSelect } from './JogSelect';
import { TicketModal } from './TicketModal';
import { TrashIcon } from './TrashIcon';
import { Epic, ORDER_GAP, STATUSES, Ticket } from '@/lib/types';

type SortKey = 'manual' | 'title' | 'jog' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function BacklogTable({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs, defaultJogId } = useJogs();
  const { epics } = useEpics();
  const [tickets, setTickets] = useState(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  const [search, setSearch] = useState('');
  const [jogFilter, setJogFilter] = useState('all');
  const hasAppliedDefaultJogFilter = useRef(false);

  // `jogs` is fetched client-side (see JogsContext) so `defaultJogId` isn't known on the
  // first render or two — apply it once it becomes available, but only ever once, so it
  // doesn't clobber a filter the user has since changed.
  useEffect(() => {
    if (hasAppliedDefaultJogFilter.current || !defaultJogId) return;
    hasAppliedDefaultJogFilter.current = true;
    setJogFilter(defaultJogId);
  }, [defaultJogId]);
  const [epicFilter, setEpicFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const jogNameById = useMemo(() => new Map(jogs.map((jog) => [jog.id, jog.name])), [jogs]);
  const epicById = useMemo(() => new Map(epics.map((epic) => [epic.id, epic])), [epics]);
  const statusLabelByValue = useMemo(() => new Map(STATUSES.map((s) => [s.value, s.label])), []);
  const visibleJogs = useMemo(() => jogs.filter((jog) => showArchived || !jog.isArchived), [jogs, showArchived]);
  const visibleEpics = useMemo(() => epics.filter((epic) => showArchived || !epic.isArchived), [epics, showArchived]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Reordering assumes visibleTickets is exactly the full underlying list (just re-sorted),
  // so it can safely be disabled whenever any filter — including "hide archived", which is
  // the default — narrows what's shown.
  const canReorder =
    sortKey === 'manual' && !search.trim() && jogFilter === 'all' && epicFilter === 'all' && !showArchived;

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

    if (!showArchived) {
      result = result.filter((ticket) => !ticket.isArchived);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(query) || ticket.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    if (jogFilter !== 'all') {
      result = result.filter((ticket) => ticket.jogId === jogFilter);
    }

    if (epicFilter !== 'all') {
      result = result.filter((ticket) => (epicFilter === 'none' ? !ticket.epicId : ticket.epicId === epicFilter));
    }

    const direction = sortDirection === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      // Newest tickets get the highest `order` (see createTicket), so sorting manual order
      // newest-first means descending — the most recently added tickets land at the top of
      // the list instead of the bottom.
      if (sortKey === 'manual') return b.order - a.order;
      if (sortKey === 'title') return a.title.localeCompare(b.title) * direction;
      if (sortKey === 'jog') {
        const nameA = jogNameById.get(a.jogId) ?? '';
        const nameB = jogNameById.get(b.jogId) ?? '';
        return nameA.localeCompare(nameB) * direction;
      }
      return a.createdAt.localeCompare(b.createdAt) * direction;
    });

    return result;
  }, [tickets, search, jogFilter, epicFilter, sortKey, sortDirection, jogNameById, showArchived]);

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

  async function handleToggleArchive(ticketId: string, nextArchived: boolean) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, isArchived: nextArchived } : t)));
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: nextArchived }),
    });
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

    const moved = arrayMove(visibleTickets, oldIndex, newIndex);
    const movedIndex = moved.findIndex((t) => t.id === active.id);
    // `moved` is sorted newest-first (descending `order`) when manually sorted, so the
    // neighbor above the dragged row has the larger order and the neighbor below has the
    // smaller one — the reverse of computeOrderBetween's ascending (before < after) convention.
    const before = moved[movedIndex + 1]?.order ?? null;
    const after = moved[movedIndex - 1]?.order ?? null;
    const newOrder = computeOrderBetween(before, after);

    if (needsRebalance(before, after, newOrder)) {
      // `moved` is derived from visibleTickets, which excludes archived tickets — update order
      // in place rather than replacing `tickets` wholesale, or archived tickets would be dropped
      // from local state until the next reload. Index 0 (newest/top of the descending list)
      // must get the highest order, so the mapping counts down rather than up.
      const lastIndex = moved.length - 1;
      const orderById = new Map(moved.map((ticket, index) => [ticket.id, (lastIndex - index) * ORDER_GAP]));
      setTickets((prev) => prev.map((t) => (orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t)));
      await fetch('/api/tickets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // reorderTickets assigns ascending order matching array position (first id = lowest
        // order), so send the array oldest-first — the reverse of the newest-first `moved`.
        body: JSON.stringify({ order: [...moved].reverse().map((t) => t.id) }),
      });
      return;
    }

    setTickets((prev) => prev.map((t) => (t.id === active.id ? { ...t, order: newOrder } : t)));

    await fetch(`/api/tickets/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder }),
    });
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={jogFilter}
            onChange={(event) => setJogFilter(event.target.value)}
            className="appearance-none rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All jogs</option>
            {visibleJogs.map((jog) => (
              <option key={jog.id} value={jog.id}>
                {jog.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        </div>
        <div className="relative">
          <select
            value={epicFilter}
            onChange={(event) => setEpicFilter(event.target.value)}
            className="appearance-none rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All epics</option>
            <option value="none">No epic</option>
            {visibleEpics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="tt-checkbox"
          />
          Show archived
        </label>
        <FilterInput value={search} onChange={setSearch} placeholder="Filter by title or tag…" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* Desktop: table with drag-reorder */}
        <div className="hidden rounded-lg border border-gray-200 lg:block dark:border-gray-800">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
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
              <SortableContext items={visibleTickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {visibleTickets.map((ticket) => (
                    <SortableTicketRow
                      key={ticket.id}
                      ticket={ticket}
                      disabled={!canReorder}
                      statusLabel={statusLabelByValue.get(ticket.status)}
                      epic={ticket.epicId ? epicById.get(ticket.epicId) : undefined}
                      onEdit={() => setEditingTicket(ticket)}
                      onDelete={() => setDeletingTicket(ticket)}
                      onReassign={(jogId) => handleReassign(ticket.id, jogId)}
                      onToggleArchive={() => handleToggleArchive(ticket.id, !ticket.isArchived)}
                    />
                  ))}
                  {visibleTickets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-400 dark:text-gray-500">
                        No tickets found.
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
          {visibleTickets.map((ticket) => (
            <BacklogCard
              key={ticket.id}
              ticket={ticket}
              statusLabel={statusLabelByValue.get(ticket.status)}
              epic={ticket.epicId ? epicById.get(ticket.epicId) : undefined}
              onEdit={() => setEditingTicket(ticket)}
              onDelete={() => setDeletingTicket(ticket)}
              onReassign={(jogId) => handleReassign(ticket.id, jogId)}
              onToggleArchive={() => handleToggleArchive(ticket.id, !ticket.isArchived)}
            />
          ))}
          {visibleTickets.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No tickets found.</p>
          )}
        </div>
      </div>

      {editingTicket && (
        <TicketModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

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
  epic: Epic | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onReassign: (jogId: string) => void;
  onToggleArchive: () => void;
}

function SortableTicketRow({
  ticket,
  disabled,
  statusLabel,
  epic,
  onEdit,
  onDelete,
  onReassign,
  onToggleArchive,
}: SortableTicketRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    disabled,
  });

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
          className={`flex items-center justify-center ${
            disabled
              ? 'cursor-not-allowed text-gray-200 dark:text-gray-700'
              : 'cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-300'
          }`}
          title={disabled ? 'Switch to default order (no search/filter) to reorder' : 'Drag to reorder'}
        >
          <GripIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onEdit}
          className={`text-left font-medium hover:underline ${
            ticket.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {ticket.title}
          {epic && <EpicChip epic={epic} className="ml-1.5 align-middle" />}
        </button>
      </td>
      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{statusLabel}</td>
      <td className="px-3 py-2 text-gray-600 capitalize dark:text-gray-400">{ticket.priority ?? '—'}</td>
      <td className="px-3 py-2">
        <JogSelect value={ticket.jogId} onChange={onReassign} className="w-48" />
      </td>
      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</td>
      <td className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleArchive}
            className={
              ticket.isArchived
                ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }
            aria-label={ticket.isArchived ? 'Unarchive ticket' : 'Archive ticket'}
            title={ticket.isArchived ? 'Unarchive ticket' : 'Archive ticket'}
          >
            <ArchiveIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            aria-label="Delete ticket"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

interface BacklogCardProps {
  ticket: Ticket;
  statusLabel: string | undefined;
  epic: Epic | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onReassign: (jogId: string) => void;
  onToggleArchive: () => void;
}

function BacklogCard({ ticket, statusLabel, epic, onEdit, onDelete, onReassign, onToggleArchive }: BacklogCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onEdit}
          className={`text-left text-sm font-medium hover:underline ${
            ticket.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {ticket.title}
          {epic && <EpicChip epic={epic} className="ml-1.5 align-middle" />}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleArchive}
            className={
              ticket.isArchived
                ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }
            aria-label={ticket.isArchived ? 'Unarchive ticket' : 'Archive ticket'}
            title={ticket.isArchived ? 'Unarchive ticket' : 'Archive ticket'}
          >
            <ArchiveIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            aria-label="Delete ticket"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {statusLabel}
        </span>
        {ticket.priority && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 capitalize dark:bg-gray-700 dark:text-gray-300">
            {ticket.priority}
          </span>
        )}
        <span className="text-gray-400 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="mt-2">
        <JogSelect value={ticket.jogId} onChange={onReassign} className="w-full" />
      </div>
    </div>
  );
}
