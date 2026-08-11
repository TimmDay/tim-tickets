'use client';

import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useJogs } from '@/lib/JogsContext';
import { JogSelect } from './JogSelect';
import { JogColumn } from './JogColumn';
import { TicketModal } from './TicketModal';
import { STATUSES, Ticket, TicketStatus } from '@/lib/types';

export function JogBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedJogId, setSelectedJogId] = useState(jogs[0]?.id ?? '');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

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
    for (const ticket of tickets) {
      if (ticket.jogId === selectedJogId) {
        grouped[ticket.status].push(ticket);
      }
    }
    return grouped;
  }, [tickets, selectedJogId]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const ticketId = active.id as string;
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));

    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  function handleSaved(ticket: Ticket) {
    setTickets((prev) => (prev.some((t) => t.id === ticket.id) ? prev.map((t) => (t.id === ticket.id ? ticket : t)) : [...prev, ticket]));
  }

  function handleDeleted(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <JogSelect value={selectedJogId} onChange={setSelectedJogId} className="w-64" />
        {selectedJog && (selectedJog.startDate || selectedJog.endDate) && (
          <span className="text-sm text-gray-500">
            {selectedJog.startDate ?? '…'} → {selectedJog.endDate ?? '…'}
          </span>
        )}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-5 gap-3">
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
