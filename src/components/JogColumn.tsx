'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TicketCard } from './TicketCard';
import { Ticket, TicketStatus } from '@/lib/types';

interface JogColumnProps {
  status: TicketStatus;
  label: string;
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

export function JogColumn({ status, label, tickets, onSelectTicket }: JogColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full flex-col rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-white/5 ${
        isOver ? 'bg-gray-100 ring-2 ring-gray-300 dark:bg-gray-800 dark:ring-gray-600' : ''
      }`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{tickets.length}</span>
      </div>
      <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onSelectTicket(ticket)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
