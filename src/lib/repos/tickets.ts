import { FieldValue } from '@google-cloud/firestore';
import { AGENT_COMMENT_PREFIX } from '../agentRuns';
import {
  AgentModel,
  Comment,
  ORDER_GAP,
  Priority,
  ScreenshotContentType,
  Ticket,
  TicketScreenshot,
  TicketStatus,
} from '../types';
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
    agentModel: (data.agentModel as AgentModel | null) ?? null,
    agentDispatchedAt: (data.agentDispatchedAt as string | null) ?? null,
    screenshot: (data.screenshot as TicketScreenshot | null) ?? null,
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
  agentModel: AgentModel | null;
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
  agentModel?: AgentModel | null;
  agentDispatchedAt?: string | null;
  order?: number;
  isArchived?: boolean;
}

export type AgentReport =
  | { outcome: 'pr_opened'; prUrl: string }
  | { outcome: 'merged'; prUrl: string }
  | { outcome: 'no_changes' | 'failed'; runUrl?: string }
  /** The agent judged the ticket's changes to already be in the codebase. */
  | { outcome: 'already_done'; reason?: string; runUrl?: string };

/** Status a report moves the ticket to, if any. */
const AGENT_REPORT_STATUS: Partial<Record<AgentReport['outcome'], TicketStatus>> = {
  pr_opened: 'in_review',
  merged: 'done',
  // Needs a human: either the ticket is stale, or the agent misjudged it.
  already_done: 'blocked',
};

function agentReportComment(report: AgentReport): string {
  switch (report.outcome) {
    case 'pr_opened':
      return `${AGENT_COMMENT_PREFIX} Agent opened a PR: ${report.prUrl}`;
    case 'merged':
      return `${AGENT_COMMENT_PREFIX} Agent PR merged: ${report.prUrl}`;
    case 'already_done': {
      const reason = report.reason?.trim();
      return `${AGENT_COMMENT_PREFIX} It seems these changes have already been made${reason ? `: ${reason}` : '.'}${
        report.runUrl ? `\n\nAgent run: ${report.runUrl}` : ''
      }`;
    }
    case 'no_changes':
    case 'failed': {
      const what = report.outcome === 'no_changes' ? 'finished without making any changes' : 'run failed';
      return `${AGENT_COMMENT_PREFIX} Agent ${what}${report.runUrl ? `: ${report.runUrl}` : ''}`;
    }
  }
}

export function createTicketsRepo(db: FirestoreLike) {
  const ticketsCollection = () => db.collection('tickets');
  const countersCollection = () => db.collection('counters');
  // Ticket updates can stamp the parent epic's `startedAt` — see `updateTicket` below. Reached
  // into directly rather than depending on the epics repo: threading a repo-to-repo dependency
  // for one field stamp isn't worth it at this scope.
  const epicsCollection = () => db.collection('epics');
  // Screenshot bytes, one doc per ticket keyed by ticket id — kept out of the ticket doc itself
  // so getTickets() never downloads images.
  const screenshotsCollection = () => db.collection('ticketScreenshots');

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
      agentModel: input.agentModel,
      agentDispatchedAt: null,
      screenshot: null,
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

  /** Sets explicit `order` values, for reorders that permute existing slots (e.g. the board's
   * sort-by-priority) rather than renumbering a full list like `reorderTickets` does. */
  async function setTicketOrders(updates: { id: string; order: number }[]): Promise<void> {
    const now = new Date().toISOString();
    await commitInChunks(
      db,
      updates.map(({ id, order }) => (batch) => batch.update(ticketsCollection().doc(id), { order, updatedAt: now })),
    );
  }

  async function updateTicket(id: string, input: UpdateTicketInput): Promise<void> {
    const now = new Date().toISOString();

    // First time any ticket in an epic moves off `todo`, stamp the epic as started. Only
    // relevant on the actual `todo` -> other transition, so the ticket is read once up front
    // and its previous status gates the rest of this — every later transition (e.g.
    // in_progress -> blocked) skips straight to the plain update below.
    if (input.status && input.status !== 'todo') {
      const ticketRef = ticketsCollection().doc(id);
      const ticketSnap = await ticketRef.get();
      const ticketData = ticketSnap.data();
      if (ticketData?.status === 'todo') {
        const epicId = input.epicId !== undefined ? input.epicId : (ticketData.epicId as string | null | undefined);
        if (epicId) {
          const epicRef = epicsCollection().doc(epicId);
          const epicSnap = await epicRef.get();
          if (epicSnap.exists && !epicSnap.data()?.startedAt) {
            await epicRef.update({ startedAt: now });
          }
        }
      }
    }

    // Screenshots are only context for in-flight work, so finishing (done) or shelving (archived)
    // a ticket discards it — keeps Firestore storage from accumulating images nobody will use.
    // Batched with the update; deleting an absent screenshot doc is a no-op.
    if (input.status === 'done' || input.isArchived === true) {
      const batch = db.batch();
      batch.update(ticketsCollection().doc(id), { ...input, screenshot: null, updatedAt: now });
      batch.delete(screenshotsCollection().doc(id));
      await batch.commit();
      return;
    }

    await ticketsCollection()
      .doc(id)
      .update({ ...input, updatedAt: now });
  }

  /** Applies an agent workflow's report: an opened PR moves the ticket to in_review, a merged
   * one to done (AGENT_REPORT_STATUS); every outcome
   * comments and clears `agentDispatchedAt` so the ticket can be dispatched again. One
   * transaction, so the status, stamp and comment land together. Returns false if no ticket
   * has that key. */
  async function applyAgentReport(key: string, report: AgentReport): Promise<boolean> {
    const snapshot = await ticketsCollection().where('key', '==', key).limit(1).get();
    if (snapshot.empty) return false;
    const ref = ticketsCollection().doc(snapshot.docs[0].id);

    const now = new Date().toISOString();
    const comment: Comment = { id: crypto.randomUUID(), body: agentReportComment(report), createdAt: now };
    const status = AGENT_REPORT_STATUS[report.outcome];

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const comments = (doc.data()?.comments as Comment[]) ?? [];
      tx.update(ref, {
        ...(status ? { status } : {}),
        ...(status === 'done' ? { screenshot: null } : {}),
        agentDispatchedAt: null,
        comments: [...comments, comment],
        updatedAt: now,
      });
      // Same done-discards-screenshot rule as updateTicket, in the same transaction so the
      // metadata and image can't get out of step.
      if (status === 'done') tx.delete(screenshotsCollection().doc(ref.id));
    });
    return true;
  }

  async function deleteTicket(id: string): Promise<void> {
    const batch = db.batch();
    batch.delete(ticketsCollection().doc(id));
    batch.delete(screenshotsCollection().doc(id));
    await batch.commit();
  }

  /** Replaces the ticket's screenshot. Returns null if the ticket doesn't exist, is done, or is
   * archived — those never keep a screenshot (see updateTicket). */
  async function setScreenshot(
    ticketId: string,
    data: Buffer,
    contentType: ScreenshotContentType,
  ): Promise<TicketScreenshot | null> {
    const ticketRef = ticketsCollection().doc(ticketId);
    const ticketSnap = await ticketRef.get();
    const ticketData = ticketSnap.data();
    if (!ticketSnap.exists || ticketData?.status === 'done' || ticketData?.isArchived) return null;

    const now = new Date().toISOString();
    const meta: TicketScreenshot = { contentType, size: data.length, updatedAt: now };
    const batch = db.batch();
    batch.set(screenshotsCollection().doc(ticketId), { data, contentType, createdAt: now });
    batch.update(ticketRef, { screenshot: meta, updatedAt: now });
    await batch.commit();
    return meta;
  }

  async function getScreenshot(ticketId: string): Promise<{ data: Buffer; contentType: ScreenshotContentType } | null> {
    const snap = await screenshotsCollection().doc(ticketId).get();
    if (!snap.exists) return null;
    const doc = snap.data()!;
    return { data: Buffer.from(doc.data as Uint8Array), contentType: doc.contentType as ScreenshotContentType };
  }

  async function deleteScreenshot(ticketId: string): Promise<void> {
    const ticketRef = ticketsCollection().doc(ticketId);
    if (!(await ticketRef.get()).exists) return;
    const batch = db.batch();
    batch.delete(screenshotsCollection().doc(ticketId));
    batch.update(ticketRef, { screenshot: null, updatedAt: new Date().toISOString() });
    await batch.commit();
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
    setTicketOrders,
    updateTicket,
    applyAgentReport,
    deleteTicket,
    setScreenshot,
    getScreenshot,
    deleteScreenshot,
    addComment,
    deleteComment,
  };
}

export type TicketsRepo = ReturnType<typeof createTicketsRepo>;
