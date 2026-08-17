'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EpicChip } from './EpicChip';
import { useEpics } from '@/lib/EpicsContext';
import { Priority, Ticket } from '@/lib/types';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const POPOVER_WIDTH = 224; // matches w-56

export function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { epics } = useEpics();
  const epic = epics.find((epic) => epic.id === ticket.epicId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    disabled: ticket.isArchived,
  });
  const iconRef = useRef<HTMLSpanElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  function cancelHide() {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }

  function showPopover() {
    cancelHide();
    const rect = iconRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopoverPosition({ top: rect.bottom + 4, left: rect.right - POPOVER_WIDTH });
  }

  function scheduleHide() {
    cancelHide();
    hideTimeoutRef.current = setTimeout(() => setPopoverPosition(null), 100);
  }

  useEffect(() => {
    if (!popoverPosition) return;
    // The popover is `position: fixed` at coordinates captured when it opened, so it doesn't
    // track the icon as the page scrolls — on mobile in particular (where it's opened via
    // tap-simulated hover, which lingers), that leaves it visually detached from its trigger.
    // Close it on any scroll rather than trying to keep it pinned in place.
    function handleScroll() {
      cancelHide();
      setPopoverPosition(null);
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [popoverPosition]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative cursor-pointer rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {ticket.priority && ticket.status !== 'done' && (
        <span
          title={`Priority: ${ticket.priority}`}
          className={`absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${PRIORITY_COLORS[ticket.priority]}`}
        />
      )}

      {ticket.comments.length > 0 && (
        <div
          className="absolute top-1 right-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseEnter={showPopover}
          onMouseLeave={scheduleHide}
        >
          <span
            ref={iconRef}
            className="flex h-4 w-4 items-center justify-center rounded-full text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ⓘ
          </span>
        </div>
      )}

      <p
        className={`font-medium ${ticket.comments.length > 0 ? 'pr-5' : ''} ${
          ticket.isArchived ? 'text-gray-500 italic dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {ticket.title}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {ticket.tags.map((tag) => (
          <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {tag}
          </span>
        ))}
        {epic && <EpicChip epic={epic} className="ml-auto" />}
      </div>

      {popoverPosition &&
        createPortal(
          <div
            style={{ position: 'fixed', top: popoverPosition.top, left: popoverPosition.left, width: POPOVER_WIDTH }}
            className="z-50 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {ticket.comments.map((comment) => (
                <li key={comment.id}>
                  <p className="text-gray-700 dark:text-gray-300">{comment.body}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
