'use client';

import { useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useJogs } from '@/lib/JogsContext';
import { computeOrderBetween, needsRebalance } from '@/lib/ordering';
import { JogSelect } from './JogSelect';
import { JogColumn } from './JogColumn';
import { TicketModal } from './TicketModal';
import { ORDER_GAP, STATUSES, Ticket, TicketStatus } from '@/lib/types';

export function JogBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const [tickets, setTickets] = useState(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);
  const [selectedJogId, setSelectedJogId] = useState(jogs[0]?.id ?? '');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [filterText, setFilterText] = useState('');

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedJog = jogs.find((jog) => jog.id === selectedJogId);

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
      if (ticket.jogId !== selectedJogId) continue;
      if (query) {
        const matches =
          ticket.title.toLowerCase().includes(query) || ticket.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matches) continue;
      }
      grouped[ticket.status].push(ticket);
    }
    return grouped;
  }, [tickets, selectedJogId, filterText]);

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
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <JogSelect value={selectedJogId} onChange={setSelectedJogId} className="w-64" />
        {selectedJog && (selectedJog.startDate || selectedJog.endDate) && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedJog.startDate ?? '…'} → {selectedJog.endDate ?? '…'}
          </span>
        )}
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter by title or tag…"
          className="ml-auto w-64 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-x-auto lg:overflow-y-hidden">
          <div className="grid grid-cols-1 gap-3 lg:h-full lg:min-w-[900px] lg:grid-cols-5">
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
