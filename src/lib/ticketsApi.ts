import type { CreateTicketInput, UpdateTicketInput, UpdateTicketResult } from '@/lib/repos';
import { Comment, Ticket, TicketScreenshot } from './types';

/**
 * Every ticket request the client makes. Each call throws when the server says no, and returns
 * what the server stored rather than what was sent, so callers never re-derive server rules.
 * The production adapter is `ticketsApi` below; tests substitute an in-memory one.
 */
export interface TicketsApi {
  list(): Promise<Ticket[]>;
  create(input: CreateTicketInput): Promise<Ticket>;
  update(id: string, patch: UpdateTicketInput): Promise<UpdateTicketResult>;
  remove(id: string): Promise<void>;
  /** Renumbers the given tickets evenly, in this order. */
  reorder(orderedIds: string[]): Promise<void>;
  /** Sets explicit order values, e.g. to permute existing slots. */
  setOrders(orders: { id: string; order: number }[]): Promise<void>;
  /** Fails for a done or archived ticket, which never keeps a screenshot. */
  setScreenshot(id: string, image: Blob): Promise<TicketScreenshot>;
  deleteScreenshot(id: string): Promise<void>;
  addComment(id: string, body: string): Promise<Comment>;
  deleteComment(id: string, commentId: string): Promise<void>;
}

async function send<T>(url: string, init: RequestInit, failure: string): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : failure);
  return data as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const ticketsApi: TicketsApi = {
  list: () => send('/api/tickets', {}, 'Failed to load tickets'),
  create: (input) => send('/api/tickets', json('POST', input), 'Failed to create ticket'),
  update: (id, patch) => send(`/api/tickets/${id}`, json('PATCH', patch), 'Failed to save ticket'),
  remove: async (id) => {
    await send(`/api/tickets/${id}`, { method: 'DELETE' }, 'Failed to delete ticket');
  },
  reorder: async (orderedIds) => {
    await send('/api/tickets/reorder', json('POST', { order: orderedIds }), 'Failed to reorder tickets');
  },
  setOrders: async (orders) => {
    await send('/api/tickets/reorder', json('POST', { orders }), 'Failed to reorder tickets');
  },
  setScreenshot: (id, image) =>
    send(
      `/api/tickets/${id}/screenshot`,
      { method: 'PUT', headers: { 'Content-Type': image.type }, body: image },
      'Upload failed',
    ),
  deleteScreenshot: async (id) => {
    await send(`/api/tickets/${id}/screenshot`, { method: 'DELETE' }, 'Removing the screenshot failed');
  },
  addComment: (id, body) => send(`/api/tickets/${id}/comments`, json('POST', { body }), 'Failed to add comment'),
  deleteComment: async (id, commentId) => {
    await send(`/api/tickets/${id}/comments/${commentId}`, { method: 'DELETE' }, 'Failed to delete comment');
  },
};
