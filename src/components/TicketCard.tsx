'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/lib/types';

const PRIORITY_COLORS: Record<Ticket['priority'], string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-pointer rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm hover:border-gray-300 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <p className="font-medium text-gray-900">{ticket.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
        {ticket.tags.map((tag) => (
          <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
