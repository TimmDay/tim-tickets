'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/lib/types';

const PRIORITY_COLORS: Record<Ticket['priority'], string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative cursor-pointer rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm hover:border-gray-300 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div
        className="group absolute top-1 right-1"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full text-xs text-gray-400 hover:text-gray-600">
          ⓘ
        </span>
        <div className="invisible absolute top-full right-0 z-10 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg group-hover:visible">
          {ticket.comments.length === 0 ? (
            <p className="text-gray-400">No comments yet.</p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {ticket.comments.map((comment) => (
                <li key={comment.id}>
                  <p className="text-gray-700">{comment.body}</p>
                  <p className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="pr-5 font-medium text-gray-900">{ticket.title}</p>
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
