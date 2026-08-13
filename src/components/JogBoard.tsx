'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useJogs } from '@/lib/JogsContext';
import { computeOrderBetween, needsRebalance } from '@/lib/ordering';
import { FilterInput } from './FilterInput';
import { JogSelect } from './JogSelect';
import { JogColumn } from './JogColumn';
import { TicketModal } from './TicketModal';
import { ORDER_GAP, STATUSES, Ticket, TicketStatus } from '@/lib/types';

const SELECTED_JOG_STORAGE_KEY = 'tt_selected_jog_id';

export function JogBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const [tickets, setTickets] = useState(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);
  const [selectedJogId, setSelectedJogId] = useState(jogs[0]?.id ?? '');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const hasRestoredSelection = useRef(false);

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  // Restore a previously-selected jog from localStorage once the jogs list is available.
  // This must happen post-mount (not during the initial render) since localStorage isn't
  // available during server rendering and reading it there would cause a hydration mismatch.
  useEffect(() => {
    if (hasRestoredSelection.current) return;
    hasRestoredSelection.current = true;
    const stored = localStorage.getItem(SELECTED_JOG_STORAGE_KEY);
    if (!stored) return;
    if (jogs.some((jog) => jog.id === stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from localStorage genuinely cannot happen during render without a hydration mismatch
      setSelectedJogId(stored);
    } else {
      // The jog this pointed to no longer exists (e.g. deleted since we last saved it) — drop the stale entry.
      localStorage.removeItem(SELECTED_JOG_STORAGE_KEY);
    }
  }, [jogs]);

  function handleSelectJog(jogId: string) {
    setSelectedJogId(jogId);
    localStorage.setItem(SELECTED_JOG_STORAGE_KEY, jogId);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Falls back to the first jog if the selected one is no longer valid (deleted, or restored
  // from a stale localStorage entry before the jogs list loaded) — derived at use-time so no
  // extra state/effect is needed to keep it in sync.
  const effectiveJogId = jogs.some((jog) => jog.id === selectedJogId) ? selectedJogId : (jogs[0]?.id ?? '');
  const selectedJog = jogs.find((jog) => jog.id === effectiveJogId);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<TicketStatus, Ticket[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      in_review: [],
      done: [],
    };
    const sorted = [...tickets].sort((a, b) => a.order - b.order);
    const query = filterText.trim().toLowerCase();
    for (const ticket of sorted) {
      if (ticket.jogId !== effectiveJogId) continue;
      if (ticket.isArchived && !showArchived) continue;
      if (query) {
        const matches =
          ticket.title.toLowerCase().includes(query) || ticket.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matches) continue;
      }
      grouped[ticket.status].push(ticket);
    }
    return grouped;
  }, [tickets, effectiveJogId, filterText, showArchived]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTicket = tickets.find((t) => t.id === activeId);
    if (!activeTicket) return;

    const overIsColumn = STATUSES.some((s) => s.value === overId);
    const targetStatus: TicketStatus = overIsColumn
      ? (overId as TicketStatus)
      : (tickets.find((t) => t.id === overId)?.status ?? activeTicket.status);
    const statusChanged = activeTicket.status !== targetStatus;

    const sorted = [...tickets].sort((a, b) => a.order - b.order);
    const withoutActive = sorted.filter((t) => t.id !== activeId);

    let insertIndex: number;
    if (overIsColumn) {
      let lastInColumnIndex = -1;
      for (let i = withoutActive.length - 1; i >= 0; i--) {
        if (withoutActive[i].status === targetStatus) {
          lastInColumnIndex = i;
          break;
        }
      }
      insertIndex = lastInColumnIndex === -1 ? withoutActive.length : lastInColumnIndex + 1;
    } else {
      insertIndex = withoutActive.findIndex((t) => t.id === overId);
      if (insertIndex === -1) insertIndex = withoutActive.length;
    }

    const before = withoutActive[insertIndex - 1]?.order ?? null;
    const after = withoutActive[insertIndex]?.order ?? null;
    const newOrder = computeOrderBetween(before, after);

    if (needsRebalance(before, after, newOrder)) {
      const updatedActive: Ticket = { ...activeTicket, status: targetStatus };
      const rebalanced = [
        ...withoutActive.slice(0, insertIndex),
        updatedActive,
        ...withoutActive.slice(insertIndex),
      ].map((ticket, index) => ({ ...ticket, order: index * ORDER_GAP }));

      setTickets(rebalanced);

      await fetch('/api/tickets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: rebalanced.map((t) => t.id) }),
      });

      if (statusChanged) {
        await fetch(`/api/tickets/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        });
      }
      return;
    }

    setTickets((prev) => prev.map((t) => (t.id === activeId ? { ...t, order: newOrder, status: targetStatus } : t)));

    await fetch(`/api/tickets/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder, status: targetStatus }),
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <JogSelect value={effectiveJogId} onChange={handleSelectJog} className="w-64" includeArchived={showArchived} />
        {selectedJog && (selectedJog.startDate || selectedJog.endDate) && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedJog.startDate ?? '…'} → {selectedJog.endDate ?? '…'}
          </span>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="tt-checkbox"
          />
          Show archived
        </label>
        <FilterInput value={filterText} onChange={setFilterText} placeholder="Filter by title or tag…" />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-x-auto lg:overflow-y-hidden">
          <div className="grid grid-cols-1 gap-3 lg:h-full lg:min-w-[900px] lg:grid-cols-5 lg:grid-rows-1">
            {STATUSES.map((status) => (
              <JogColumn
                key={status.value}
                status={status.value}
                label={status.label}
                tickets={ticketsByStatus[status.value]}
                onSelectTicket={setEditingTicket}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {editingTicket && (
        <TicketModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
