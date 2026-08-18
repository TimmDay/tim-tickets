'use client';

import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDownIcon } from './ChevronDownIcon';
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
  const [collapsed, setCollapsed] = useState(false);

  // Defaults every column but In Progress to closed on mobile — but only there, since desktop
  // shows all columns side by side where collapsing isn't the useful default. Must happen
  // post-mount (not during the initial render) since window isn't available during server
  // rendering and reading it there would cause a hydration mismatch — the `lg:` breakpoint here
  // (1024px) matches the one this app already uses everywhere else for the mobile/desktop split.
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile && status !== 'in_progress') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- setting the mobile default genuinely cannot happen during render without a hydration mismatch
      setCollapsed(true);
    }
  }, [status]);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-white/5 ${
        collapsed ? 'lg:self-start' : 'lg:h-full'
      } ${isOver ? 'bg-gray-100 ring-2 ring-gray-300 dark:bg-gray-800 dark:ring-gray-600' : ''}`}
    >
      <div className="flex shrink-0 items-center gap-1.5 px-1 py-1">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand column' : 'Collapse column'}
          aria-expanded={!collapsed}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        <h3 className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{tickets.length}</span>
      </div>
      {!collapsed && (
        <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={() => onSelectTicket(ticket)} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
