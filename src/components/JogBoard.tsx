'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEpics } from '@/lib/EpicsContext';
import { useJogs } from '@/lib/JogsContext';
import { computeReorder } from '@/lib/ordering';
import { useShowArchived } from '@/lib/ShowArchivedContext';
import { ChevronDownIcon } from './ChevronDownIcon';
import { FilterInput } from './FilterInput';
import { JogSelect } from './JogSelect';
import { JogColumn } from './JogColumn';
import { TicketModal } from './TicketModal';
import { ALL_JOGS_ID, STATUSES, Ticket, TicketStatus } from '@/lib/types';

const SELECTED_JOG_STORAGE_KEY = 'tt_selected_jog_id';

export function JogBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const { epics } = useEpics();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);
  const [selectedJogId, setSelectedJogId] = useState(jogs[0]?.id ?? '');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [filterText, setFilterText] = useState('');
  const { showArchived, setShowArchived } = useShowArchived();
  const [epicFilter, setEpicFilter] = useState('all');
  const hasRestoredSelection = useRef(false);

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  // Restore a previously-selected jog once the jogs list is available. A `jogId` (and/or
  // `epicId`) query param — e.g. from clicking a jog/epic title on the Jogs/Epics pages —
  // takes priority over whatever was last persisted to localStorage; either way this must
  // happen post-mount (not during the initial render) since localStorage isn't available
  // during server rendering and reading it there would cause a hydration mismatch.
  // `jogs` is now fetched client-side (see JogsContext) so it's genuinely empty for the
  // first render or two — wait for it to actually populate (always non-empty once loaded,
  // per `ensureDefaultJog`) before validating a jogId against it and locking this to run-once,
  // otherwise a real jogId/localStorage entry would always fail validation against `[]`.
  useEffect(() => {
    if (hasRestoredSelection.current) return;
    if (jogs.length === 0) return;
    hasRestoredSelection.current = true;

    const jogIdParam = searchParams.get('jogId');
    const epicIdParam = searchParams.get('epicId');

    let jogIdToApply: string | null = null;
    if (jogIdParam && (jogIdParam === ALL_JOGS_ID || jogs.some((jog) => jog.id === jogIdParam))) {
      jogIdToApply = jogIdParam;
    } else {
      const stored = localStorage.getItem(SELECTED_JOG_STORAGE_KEY);
      if (stored) {
        if (stored === ALL_JOGS_ID || jogs.some((jog) => jog.id === stored)) {
          jogIdToApply = stored;
        } else {
          // The jog this pointed to no longer exists (e.g. deleted since we last saved it) — drop the stale entry.
          localStorage.removeItem(SELECTED_JOG_STORAGE_KEY);
        }
      }
    }

    if (jogIdToApply) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring/applying selection genuinely cannot happen during render without a hydration mismatch
      setSelectedJogId(jogIdToApply);
      localStorage.setItem(SELECTED_JOG_STORAGE_KEY, jogIdToApply);
    }

    if (epicIdParam) {
      setEpicFilter(epicIdParam);
    }

    if (jogIdParam || epicIdParam) {
      router.replace('/', { scroll: false });
    }
  }, [jogs, searchParams, router]);

  function handleSelectJog(jogId: string) {
    setSelectedJogId(jogId);
    localStorage.setItem(SELECTED_JOG_STORAGE_KEY, jogId);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Falls back to the first jog if the selected one is no longer valid (deleted, or restored
  // from a stale localStorage entry before the jogs list loaded) — derived at use-time so no
  // extra state/effect is needed to keep it in sync. ALL_JOGS_ID is always valid since it
  // doesn't reference a specific jog.
  const effectiveJogId =
    selectedJogId === ALL_JOGS_ID || jogs.some((jog) => jog.id === selectedJogId)
      ? selectedJogId
      : (jogs[0]?.id ?? '');
  const selectedJog = jogs.find((jog) => jog.id === effectiveJogId);
  const visibleEpics = useMemo(() => epics.filter((epic) => showArchived || !epic.isArchived), [epics, showArchived]);

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
      if (effectiveJogId !== ALL_JOGS_ID && ticket.jogId !== effectiveJogId) continue;
      if (ticket.isArchived && !showArchived) continue;
      if (epicFilter !== 'all' && (epicFilter === 'none' ? ticket.epicId : ticket.epicId !== epicFilter)) continue;
      if (query) {
        const matches =
          ticket.title.toLowerCase().includes(query) || ticket.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matches) continue;
      }
      grouped[ticket.status].push(ticket);
    }
    return grouped;
  }, [tickets, effectiveJogId, filterText, showArchived, epicFilter]);

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

    // The target column's own tickets (unfiltered by search/jog/epic — a drag always
    // reasons about the full column, same as before) are the list `computeReorder` needs;
    // status is its own concern, so the moved ticket is spliced in with it already applied.
    // For a same-column drag the moved ticket keeps its place in the list (so arrayMove sees
    // its real oldIndex and shifts direction correctly); for a cross-column drag it has no
    // place yet, so it's appended before arrayMove relocates it.
    const movedTicket: Ticket = { ...activeTicket, status: targetStatus };
    const baseColumnTickets = tickets
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.order - b.order)
      .map((t) => (t.id === activeId ? movedTicket : t));
    const columnTickets = statusChanged ? [...baseColumnTickets, movedTicket] : baseColumnTickets;

    const oldIndex = columnTickets.findIndex((t) => t.id === activeId);
    const overIndex = overIsColumn ? columnTickets.length - 1 : columnTickets.findIndex((t) => t.id === overId);
    const newIndex = overIndex === -1 ? columnTickets.length - 1 : overIndex;
    const orderedList = arrayMove(columnTickets, oldIndex, newIndex);

    const { orderUpdates, persist } = computeReorder(orderedList, activeId);

    setTickets((prev) =>
      prev.map((t) => {
        const newOrder = orderUpdates.get(t.id);
        if (newOrder === undefined) return t;
        return t.id === activeId ? { ...t, status: targetStatus, order: newOrder } : { ...t, order: newOrder };
      }),
    );

    if (persist.kind === 'bulk') {
      await fetch('/api/tickets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: persist.orderedIds }),
      });
      if (statusChanged) {
        await fetch(`/api/tickets/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        });
      }
    } else {
      await fetch(`/api/tickets/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusChanged ? { order: persist.order, status: targetStatus } : { order: persist.order }),
      });
    }
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
        <JogSelect
          value={effectiveJogId}
          onChange={handleSelectJog}
          className="w-64"
          includeArchived={showArchived}
          includeAllOption
        />
        {selectedJog && (selectedJog.startDate || selectedJog.endDate) && (
          <div className="flex flex-col text-xs leading-tight text-gray-500 dark:text-gray-400">
            <span>{selectedJog.startDate ?? '…'}</span>
            <span>{selectedJog.endDate ?? '…'}</span>
          </div>
        )}
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
