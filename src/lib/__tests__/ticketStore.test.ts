import { describe, expect, it, vi } from 'vitest';
import { createTicketStore } from '../ticketStore';
import type { TicketsApi } from '../ticketsApi';
import { Ticket } from '../types';

function ticket(id: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    key: `T-${id}`,
    title: id,
    body: '',
    status: 'todo',
    jogId: 'jog',
    epicId: null,
    priority: null,
    dueDate: null,
    tags: [],
    agentModel: null,
    agentDispatchedAt: null,
    screenshot: null,
    comments: [],
    order: 0,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A promise the test resolves or rejects by hand, to control when the "server" answers. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeApi(overrides: Partial<TicketsApi> = {}): TicketsApi {
  const unused = () => Promise.reject(new Error('not used in this test'));
  return {
    list: unused,
    create: unused,
    update: unused,
    remove: async () => {},
    reorder: async () => {},
    setOrders: async () => {},
    setScreenshot: unused,
    deleteScreenshot: unused,
    addComment: unused,
    deleteComment: unused,
    ...overrides,
  };
}

const screenshot = { contentType: 'image/png' as const, size: 4, updatedAt: '2026-01-01T00:00:00.000Z' };

describe('ticketStore.update', () => {
  it('shows the change at once, then takes the server copy, including fields the server derived', async () => {
    const server = deferred<{ ticket: Ticket; epicStarted: boolean }>();
    const store = createTicketStore([ticket('a', { screenshot })], fakeApi({ update: () => server.promise }));

    const pending = store.update('a', { isArchived: true });
    expect(store.getSnapshot().tickets[0]).toMatchObject({ isArchived: true, screenshot });

    server.resolve({ ticket: ticket('a', { isArchived: true, screenshot: null }), epicStarted: false });
    await pending;
    expect(store.getSnapshot().tickets[0]).toMatchObject({ isArchived: true, screenshot: null });
  });

  it('reloads from the server and reports the error when the server refuses', async () => {
    const store = createTicketStore(
      [ticket('a'), ticket('b')],
      fakeApi({
        update: () => Promise.reject(new Error('Firestore unavailable')),
        list: async () => [ticket('a'), ticket('b')],
      }),
    );

    await store.update('a', { jogId: 'other' });

    expect(store.getSnapshot().tickets.map((t) => t.jogId)).toEqual(['jog', 'jog']);
    expect(store.getSnapshot().error).toBe('Firestore unavailable');
  });

  it('tells the caller when an update started an epic', async () => {
    const onEpicStarted = vi.fn();
    const store = createTicketStore(
      [ticket('a')],
      fakeApi({ update: async () => ({ ticket: ticket('a', { status: 'in_progress' }), epicStarted: true }) }),
      { onEpicStarted },
    );

    await store.update('a', { status: 'in_progress' });

    expect(onEpicStarted).toHaveBeenCalledOnce();
  });
});

describe('ticketStore.move', () => {
  it('applies new orders and the status change together, and sends both', async () => {
    const reorder = vi.fn(async () => {});
    // The status update read the ticket before the renumber landed, so it still has order 1.
    const update = vi.fn(async () => ({ ticket: ticket('a', { status: 'done', order: 1 }), epicStarted: false }));
    const store = createTicketStore([ticket('a', { order: 1 }), ticket('b', { order: 2 })], fakeApi({ reorder, update }));

    await store.move(
      new Map([
        ['a', 5],
        ['b', 10],
      ]),
      { kind: 'bulk', orderedIds: ['a', 'b'] },
      { id: 'a', status: 'done' },
    );

    expect(reorder).toHaveBeenCalledWith(['a', 'b']);
    expect(update).toHaveBeenCalledWith('a', { status: 'done' });
    expect(store.getSnapshot().tickets.map((t) => [t.id, t.status, t.order])).toEqual([
      ['a', 'done', 5],
      ['b', 'todo', 10],
    ]);
  });

  it('sends a single move as one update carrying order and status', async () => {
    const update = vi.fn(async () => ({ ticket: ticket('a', { status: 'blocked', order: 7 }), epicStarted: false }));
    const store = createTicketStore([ticket('a')], fakeApi({ update }));

    await store.move(new Map([['a', 7]]), { kind: 'single', id: 'a', order: 7 }, { id: 'a', status: 'blocked' });

    expect(update).toHaveBeenCalledWith('a', { order: 7, status: 'blocked' });
  });
});

describe('ticketStore local changes', () => {
  it('takes saved and deleted tickets from the ticket modal, and tells subscribers', () => {
    const store = createTicketStore([ticket('a')], fakeApi());
    const listener = vi.fn();
    store.subscribe(listener);

    store.saved(ticket('a', { title: 'Renamed' }));
    store.saved(ticket('b'));
    store.deleted('a');

    expect(store.getSnapshot().tickets.map((t) => [t.id, t.title])).toEqual([['b', 'b']]);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
