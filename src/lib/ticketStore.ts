import type { UpdateTicketInput } from '@/lib/repos';
import { ReorderPersist } from './ordering';
import type { TicketsApi } from './ticketsApi';
import { Ticket, TicketStatus } from './types';

export interface TicketStoreState {
  tickets: Ticket[];
  /** The last failed change. Cleared by `clearError` or the next change. */
  error: string | null;
}

/**
 * Client-side owner of a page's ticket list. Each change shows at once, then settles to the
 * ticket the server returns, so server-side rules (e.g. done or archived clears the screenshot)
 * show without being re-implemented here. A failed change reloads the list from the server and
 * reports the error. Framework-free so it can be tested in node; `useTicketStore` binds it to
 * React.
 */
export function createTicketStore(
  initialTickets: Ticket[],
  api: TicketsApi,
  { onEpicStarted }: { onEpicStarted?: () => void } = {},
) {
  let state: TicketStoreState = { tickets: initialTickets, error: null };
  const listeners = new Set<() => void>();

  function setState(next: Partial<TicketStoreState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  }

  /** Merges each ticket's changes into the list; a change for an unknown id adds it, null removes. */
  function apply(changes: Map<string, Partial<Ticket> | null>) {
    const tickets = state.tickets
      .filter((t) => changes.get(t.id) !== null)
      .map((t) => ({ ...t, ...changes.get(t.id) }));
    for (const [id, change] of changes) {
      if (change && !tickets.some((t) => t.id === id)) tickets.push(change as Ticket);
    }
    setState({ tickets });
  }

  async function change(optimistic: Map<string, Partial<Ticket> | null>, request: () => Promise<Ticket[] | void>) {
    apply(optimistic);
    setState({ error: null });
    try {
      const saved = (await request()) ?? [];
      apply(new Map(saved.map((t) => [t.id, t])));
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Something went wrong' });
      // Back to whatever the server actually has.
      await api.list().then((tickets) => setState({ tickets }), () => {});
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
    clearError: () => setState({ error: null }),

    /** Replaces the whole list, e.g. after loading archived tickets too. */
    replaceAll: (tickets: Ticket[]) => setState({ tickets }),
    /** A ticket the ticket modal saved: already the server's copy. */
    saved: (ticket: Ticket) => apply(new Map([[ticket.id, ticket]])),
    /** A ticket the ticket modal deleted. */
    deleted: (id: string) => apply(new Map([[id, null]])),

    update: (id: string, patch: UpdateTicketInput) =>
      change(new Map([[id, patch as Partial<Ticket>]]), async () => [await sendUpdate(id, patch)]),

    remove: (id: string) => change(new Map([[id, null]]), () => api.remove(id)),

    /** A drag: new orders from `computeReorder`, plus the dragged ticket's new column if it
     * changed. Order and status are independent fields, so a bulk renumber and the status
     * change are sent concurrently. */
    move(orderUpdates: Map<string, number>, persist: ReorderPersist, statusChange?: { id: string; status: TicketStatus }) {
      const optimistic = new Map<string, Partial<Ticket>>([...orderUpdates].map(([id, order]) => [id, { order }]));
      if (statusChange) optimistic.set(statusChange.id, { ...optimistic.get(statusChange.id), status: statusChange.status });

      return change(optimistic, async () => {
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
    setOrders: (orders: Map<string, number>) =>
      change(
        new Map([...orders].map(([id, order]) => [id, { order }])),
        () => api.setOrders([...orders].map(([id, order]) => ({ id, order }))),
      ),
  };
}

export type TicketStore = ReturnType<typeof createTicketStore>;
