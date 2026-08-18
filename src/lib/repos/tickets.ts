import { FieldValue } from '@google-cloud/firestore';
import { Comment, ORDER_GAP, Priority, Ticket, TicketStatus } from '../types';
import { commitInChunks, DocSnapshotLike, FirestoreLike } from './client';

function toTicket(doc: DocSnapshotLike): Ticket {
  const data = doc.data()!;
  return {
    id: doc.id,
    key: (data.key as string) ?? '',
    title: data.title as string,
    body: data.body as string,
    status: data.status as TicketStatus,
    jogId: data.jogId as string,
    epicId: (data.epicId as string | null) ?? null,
    priority: (data.priority as Priority | null) ?? null,
    dueDate: (data.dueDate as string | null) ?? null,
    tags: (data.tags as string[]) ?? [],
    comments: (data.comments as Comment[]) ?? [],
    order: (data.order as number) ?? new Date(data.createdAt as string).getTime(),
    isArchived: (data.isArchived as boolean) ?? false,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  };
}

export interface CreateTicketInput {
  title: string;
  body: string;
  jogId: string;
  epicId: string | null;
  priority: Priority | null;
  dueDate: string | null;
  tags: string[];
}

export interface UpdateTicketInput {
  title?: string;
  body?: string;
  status?: TicketStatus;
  jogId?: string;
  epicId?: string | null;
  priority?: Priority | null;
  dueDate?: string | null;
  tags?: string[];
  order?: number;
  isArchived?: boolean;
}

export function createTicketsRepo(db: FirestoreLike) {
  const ticketsCollection = () => db.collection('tickets');
  const countersCollection = () => db.collection('counters');
  // Ticket updates can stamp the parent epic's `startedAt` — see `updateTicket` below. Reached
  // into directly rather than depending on the epics repo: threading a repo-to-repo dependency
  // for one field stamp isn't worth it at this scope.
  const epicsCollection = () => db.collection('epics');

  const TICKET_KEY_COUNTER_ID = 'tickets';

  /** Atomically reserves `count` consecutive ticket-key numbers (e.g. requesting 3 when the
   * counter is at 5 reserves 6, 7, 8) via a transaction on a single counter doc, so concurrent
   * ticket creations — or a bulk backfill running alongside one — can never hand out the same
   * key twice. */
  async function reserveTicketKeyNumbers(count: number): Promise<number[]> {
    if (count === 0) return [];
    const ref = countersCollection().doc(TICKET_KEY_COUNTER_ID);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current: number = snap.exists ? ((snap.data()!.value as number) ?? 0) : 0;
      tx.set(ref, { value: current + count }, { merge: true });
      return Array.from({ length: count }, (_, i) => current + i + 1);
    });
  }

  async function getTickets(): Promise<Ticket[]> {
    const snapshot = await ticketsCollection().orderBy('createdAt', 'asc').get();

    // One-off backfill for tickets created before the `key` field existed — same lazy,
    // self-healing pattern as ensureDefaultJog. Only ever touches docs that don't have a key
    // yet, so it's a no-op once every ticket has been backfilled.
    const missingKeyDocs = snapshot.docs.filter((doc) => !doc.data()?.key);
    const backfilledKeys = new Map<string, string>();
    if (missingKeyDocs.length > 0) {
      const numbers = await reserveTicketKeyNumbers(missingKeyDocs.length);
      missingKeyDocs.forEach((doc, i) => backfilledKeys.set(doc.id, `T-${numbers[i]}`));
      await commitInChunks(
        db,
        missingKeyDocs.map(
          (doc) => (batch) => batch.update(ticketsCollection().doc(doc.id), { key: backfilledKeys.get(doc.id) }),
        ),
      );
    }

    return snapshot.docs.map((doc) => {
      const ticket = toTicket(doc);
      const backfilledKey = backfilledKeys.get(doc.id);
      return backfilledKey ? { ...ticket, key: backfilledKey } : ticket;
    });
  }

  async function getTicketByKey(key: string): Promise<Ticket | null> {
    const snapshot = await ticketsCollection().where('key', '==', key).limit(1).get();
    return snapshot.empty ? null : toTicket(snapshot.docs[0]);
  }

  async function createTicket(input: CreateTicketInput): Promise<Ticket> {
    const now = new Date().toISOString();
    const [keyNumber] = await reserveTicketKeyNumbers(1);
    const data = {
      key: `T-${keyNumber}`,
      title: input.title,
      body: input.body,
      status: 'todo' as TicketStatus,
      jogId: input.jogId,
      epicId: input.epicId,
      priority: input.priority,
      dueDate: input.dueDate,
      tags: input.tags,
      comments: [] as Comment[],
      order: Date.now(),
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await ticketsCollection().add(data);
    return { id: ref.id, ...data };
  }

  /** Rebalances the given tickets to evenly-spaced order values. Only needed when
   * fractional-index gaps between neighbors have collapsed too far to bisect. */
  async function reorderTickets(orderedIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    await commitInChunks(
      db,
      orderedIds.map(
        (id, index) => (batch) =>
          batch.update(ticketsCollection().doc(id), { order: index * ORDER_GAP, updatedAt: now }),
      ),
    );
  }

  async function updateTicket(id: string, input: UpdateTicketInput): Promise<void> {
    const now = new Date().toISOString();

    // First time any ticket in an epic moves off `todo`, stamp the epic as started.
    if (input.status && input.status !== 'todo') {
      const ticketRef = ticketsCollection().doc(id);
      const epicId =
        input.epicId !== undefined ? input.epicId : ((await ticketRef.get()).data()?.epicId as string | null | undefined);
      if (epicId) {
        const epicRef = epicsCollection().doc(epicId);
        const epicSnap = await epicRef.get();
        if (epicSnap.exists && !epicSnap.data()?.startedAt) {
          await epicRef.update({ startedAt: now });
        }
      }
    }

    await ticketsCollection()
      .doc(id)
      .update({ ...input, updatedAt: now });
  }

  async function deleteTicket(id: string): Promise<void> {
    await ticketsCollection().doc(id).delete();
  }

  async function addComment(ticketId: string, body: string): Promise<Comment> {
    const comment: Comment = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
    };
    await ticketsCollection()
      .doc(ticketId)
      .update({ comments: FieldValue.arrayUnion(comment), updatedAt: comment.createdAt });
    return comment;
  }

  async function deleteComment(ticketId: string, commentId: string): Promise<void> {
    const ref = ticketsCollection().doc(ticketId);
    const doc = await ref.get();
    if (!doc.exists) return;

    const comments: Comment[] = (doc.data()?.comments as Comment[]) ?? [];
    const remaining = comments.filter((comment) => comment.id !== commentId);
    await ref.update({ comments: remaining, updatedAt: new Date().toISOString() });
  }

  return {
    getTickets,
    getTicketByKey,
    createTicket,
    reorderTickets,
    updateTicket,
    deleteTicket,
    addComment,
    deleteComment,
  };
}

export type TicketsRepo = ReturnType<typeof createTicketsRepo>;
