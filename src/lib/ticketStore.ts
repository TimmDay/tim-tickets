import type { UpdateTicketInput } from '@/lib/repos';
import { ReorderPersist } from './ordering';
import type { TicketsApi } from './ticketsApi';
import { Ticket, TicketStatus } from './types';

export interface TicketStoreState {
  tickets: Ticket[];
  /** The last failed change, already rolled back. Cleared by `clearError` or the next change. */
  error: string | null;
}

/** A local change to one ticket: fields to merge, or null to remove it. */
type LocalChange = Partial<Ticket> | null;

/**
 * Client-side owner of a page's ticket list. Each change shows at once, then settles to the
 * ticket the server returns, so server-side rules (e.g. done or archived clears the screenshot)
 * show without being re-implemented here. A failed change puts back the tickets it touched,
 * unless a newer change to the same ticket has happened since. Framework-free so it can be
 * tested in node; `useTicketStore` binds it to React.
 */
export function createTicketStore(
  initialTickets: Ticket[],
  api: TicketsApi,
  { onEpicStarted }: { onEpicStarted?: () => void } = {},
) {
  let state: TicketStoreState = { tickets: initialTickets, error: null };
  const listeners = new Set<() => void>();
  // id -> number of the latest change touching that ticket, so stale answers are ignored.
  const latestChange = new Map<string, number>();
  let changeCount = 0;

  function setState(next: TicketStoreState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function applyLocal(changes: Map<string, LocalChange>, error: string | null = state.error) {
    let tickets = state.tickets
      .filter((t) => changes.get(t.id) !== null)
      .map((t) => {
        const change = changes.get(t.id);
        return change ? { ...t, ...change } : t;
      });
    // A change carrying a full ticket that isn't in the list yet (a create, or a rollback of a
    // delete) is added.
    for (const [id, change] of changes) {
      if (change && 'id' in change && !tickets.some((t) => t.id === id)) tickets = [...tickets, change as Ticket];
    }
    setState({ tickets, error });
  }

  function stamp(ids: Iterable<string>): number {
    const change = ++changeCount;
    for (const id of ids) latestChange.set(id, change);
    return change;
  }

  /** Shows `changes` now, runs `request`, then settles each ticket the server returned, or
   * rolls back on failure. Only tickets whose latest change is this one are settled or
   * rolled back. */
  async function change(changes: Map<string, LocalChange>, request: () => Promise<Ticket[] | void>) {
    const previous = new Map(state.tickets.filter((t) => changes.has(t.id)).map((t) => [t.id, t]));
    const thisChange = stamp(changes.keys());
    const isLatest = (id: string) => latestChange.get(id) === thisChange;
    applyLocal(changes, null);

    try {
      const saved = (await request()) ?? [];
      const settled = new Map<string, LocalChange>(saved.filter((t) => isLatest(t.id)).map((t) => [t.id, t]));
      if (settled.size > 0) applyLocal(settled);
    } catch (err) {
      const rollback = new Map<string, LocalChange>();
      for (const id of changes.keys()) {
        if (isLatest(id)) rollback.set(id, previous.get(id) ?? null);
      }
      applyLocal(rollback, err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function sendUpdate(id: string, patch: UpdateTicketInput): Promise<Ticket> {
    const { ticket, epicStarted } = await api.update(id, patch);
    if (epicStarted) onEpicStarted?.();
    return ticket;
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clearError() {
      if (state.error) setState({ ...state, error: null });
    },

    /** Replaces the whole list, e.g. after loading archived tickets too. */
    replaceAll(tickets: Ticket[]) {
      setState({ tickets, error: state.error });
    },
    /** A ticket the ticket modal saved: already the server's copy. */
    saved(ticket: Ticket) {
      stamp([ticket.id]);
      applyLocal(new Map([[ticket.id, ticket]]));
    },
    /** A ticket the ticket modal deleted. */
    deleted(id: string) {
      stamp([id]);
      applyLocal(new Map([[id, null]]));
    },

    update(id: string, patch: UpdateTicketInput) {
      return change(new Map([[id, patch as Partial<Ticket>]]), async () => [await sendUpdate(id, patch)]);
    },

    remove(id: string) {
      return change(new Map([[id, null]]), () => api.remove(id));
    },

    /** A drag: new orders from `computeReorder`, plus the dragged ticket's new column if it
     * changed. Order and status are independent fields, so a bulk renumber and the status
     * change are sent concurrently. */
    move(orderUpdates: Map<string, number>, persist: ReorderPersist, statusChange?: { id: string; status: TicketStatus }) {
      const changes = new Map<string, LocalChange>([...orderUpdates].map(([id, order]) => [id, { order }]));
      if (statusChange) changes.set(statusChange.id, { ...changes.get(statusChange.id), status: statusChange.status });

      return change(changes, async () => {
        if (persist.kind === 'single') {
          const status = statusChange?.id === persist.id ? { status: statusChange.status } : {};
          return [await sendUpdate(persist.id, { order: persist.order, ...status })];
        }
        const [, moved] = await Promise.all([
          api.reorder(persist.orderedIds),
          statusChange ? sendUpdate(statusChange.id, { status: statusChange.status }) : undefined,
        ]);
        // The status update can read the ticket before the renumber lands, so its order is
        // taken from the renumber rather than from that read.
        const order = moved && orderUpdates.get(moved.id);
        return moved ? [order === undefined ? moved : { ...moved, order }] : [];
      });
    },

    /** Explicit order values, e.g. the board's sort-by-priority. */
    setOrders(orders: Map<string, number>) {
      const changes = new Map<string, LocalChange>([...orders].map(([id, order]) => [id, { order }]));
      return change(changes, () => api.setOrders([...orders].map(([id, order]) => ({ id, order }))));
    },
  };
}

export type TicketStore = ReturnType<typeof createTicketStore>;
