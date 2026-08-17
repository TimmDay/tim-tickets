import { FieldValue, Firestore, QueryDocumentSnapshot, WriteBatch } from '@google-cloud/firestore';
import {
  Comment,
  DEFAULT_EPIC_COLOR_THEME,
  DEFAULT_JOG_NAME,
  Epic,
  EpicColorTheme,
  Jog,
  ORDER_GAP,
  Priority,
  Ticket,
  TicketStatus,
} from './types';

let firestore: Firestore | null = null;

function getFirestore(): Firestore {
  if (firestore) return firestore;

  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing GCP Firestore credentials (GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY)');
  }

  firestore = new Firestore({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  });
  return firestore;
}

const ticketsCollection = () => getFirestore().collection('tickets');
const jogsCollection = () => getFirestore().collection('jogs');
const epicsCollection = () => getFirestore().collection('epics');
const countersCollection = () => getFirestore().collection('counters');

const TICKET_KEY_COUNTER_ID = 'tickets';

/** Atomically reserves `count` consecutive ticket-key numbers (e.g. requesting 3 when the
 * counter is at 5 reserves 6, 7, 8) via a transaction on a single counter doc, so concurrent
 * ticket creations — or a bulk backfill running alongside one — can never hand out the same
 * key twice. */
async function reserveTicketKeyNumbers(count: number): Promise<number[]> {
  if (count === 0) return [];
  const ref = countersCollection().doc(TICKET_KEY_COUNTER_ID);
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current: number = snap.exists ? (snap.data()!.value ?? 0) : 0;
    tx.set(ref, { value: current + count }, { merge: true });
    return Array.from({ length: count }, (_, i) => current + i + 1);
  });
}

// Firestore hard-caps a single WriteBatch at 500 mutations. Cascade operations (archiving a
// jog/epic, bulk reorders) can exceed that over time as data accumulates, so mutations are
// queued up front and committed across as many batches as needed.
const FIRESTORE_BATCH_LIMIT = 500;

async function commitInChunks(mutations: ((batch: WriteBatch) => void)[]): Promise<void> {
  for (let i = 0; i < mutations.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = getFirestore().batch();
    mutations.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((mutate) => mutate(batch));
    await batch.commit();
  }
}

function toJog(doc: QueryDocumentSnapshot): Jog {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    order: data.order ?? new Date(data.createdAt).getTime(),
    isArchived: data.isArchived ?? false,
    createdAt: data.createdAt,
  };
}

function toEpic(doc: QueryDocumentSnapshot): Epic {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    description: data.description ?? '',
    colorTheme: data.colorTheme ?? DEFAULT_EPIC_COLOR_THEME,
    isArchived: data.isArchived ?? false,
    startedAt: data.startedAt ?? null,
    completedAt: data.completedAt ?? null,
    createdAt: data.createdAt,
  };
}

function toTicket(doc: QueryDocumentSnapshot): Ticket {
  const data = doc.data();
  return {
    id: doc.id,
    key: data.key ?? '',
    title: data.title,
    body: data.body,
    acceptanceCriteria: data.acceptanceCriteria ?? '',
    status: data.status,
    jogId: data.jogId,
    epicId: data.epicId ?? null,
    priority: data.priority ?? null,
    dueDate: data.dueDate ?? null,
    tags: data.tags ?? [],
    comments: data.comments ?? [],
    order: data.order ?? new Date(data.createdAt).getTime(),
    isArchived: data.isArchived ?? false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function ensureDefaultJog(): Promise<Jog> {
  const snapshot = await jogsCollection().orderBy('createdAt', 'asc').limit(1).get();
  if (!snapshot.empty) {
    return toJog(snapshot.docs[0]);
  }
  const now = new Date().toISOString();
  const data = {
    name: DEFAULT_JOG_NAME,
    startDate: null,
    endDate: null,
    order: Date.now(),
    isArchived: false,
    createdAt: now,
  };
  const ref = await jogsCollection().add(data);
  return { id: ref.id, ...data };
}

export async function getJogs(): Promise<Jog[]> {
  await ensureDefaultJog();
  const snapshot = await jogsCollection().orderBy('createdAt', 'asc').get();
  return snapshot.docs.map(toJog);
}

export async function createJog(
  name: string,
  startDate: string | null = null,
  endDate: string | null = null,
): Promise<Jog> {
  const now = new Date().toISOString();
  const data = { name, startDate, endDate, order: Date.now(), isArchived: false, createdAt: now };
  const ref = await jogsCollection().add(data);
  return { id: ref.id, ...data };
}

/** Rebalances the given jogs to evenly-spaced order values. Only needed when
 * fractional-index gaps between neighbors have collapsed too far to bisect. */
export async function reorderJogs(orderedIds: string[]): Promise<void> {
  await commitInChunks(
    orderedIds.map((id, index) => (batch) => batch.update(jogsCollection().doc(id), { order: index * ORDER_GAP })),
  );
}

export interface UpdateJogInput {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  order?: number;
  isArchived?: boolean;
}

export async function updateJog(id: string, input: UpdateJogInput): Promise<void> {
  await jogsCollection().doc(id).update({ ...input });
}

export async function deleteJog(id: string): Promise<void> {
  const defaultJog = await ensureDefaultJog();
  if (id === defaultJog.id) {
    throw new Error('Cannot delete the default jog');
  }

  const orphaned = await ticketsCollection().where('jogId', '==', id).get();
  const now = new Date().toISOString();
  const mutations: ((batch: WriteBatch) => void)[] = orphaned.docs.map(
    (doc) => (batch) => batch.update(doc.ref, { jogId: defaultJog.id, updatedAt: now }),
  );
  mutations.push((batch) => batch.delete(jogsCollection().doc(id)));
  await commitInChunks(mutations);
}

/** Archives a jog: tickets currently in the "done" column are archived along with it,
 * everything else is moved out to the default jog so it isn't stranded on a hidden jog. */
export async function completeJog(id: string): Promise<void> {
  const defaultJog = await ensureDefaultJog();
  if (id === defaultJog.id) {
    throw new Error('Cannot complete the default jog');
  }

  const jogTickets = await ticketsCollection().where('jogId', '==', id).get();
  const now = new Date().toISOString();

  const mutations: ((batch: WriteBatch) => void)[] = [(batch) => batch.update(jogsCollection().doc(id), { isArchived: true })];

  jogTickets.docs.forEach((doc) => {
    if (doc.data().status === 'done') {
      mutations.push((batch) => batch.update(doc.ref, { isArchived: true, updatedAt: now }));
    } else {
      mutations.push((batch) => batch.update(doc.ref, { jogId: defaultJog.id, updatedAt: now }));
    }
  });

  await commitInChunks(mutations);
}

export async function getEpics(): Promise<Epic[]> {
  const snapshot = await epicsCollection().orderBy('createdAt', 'asc').get();
  return snapshot.docs.map(toEpic);
}

export async function createEpic(
  name: string,
  description: string = '',
  colorTheme: EpicColorTheme = DEFAULT_EPIC_COLOR_THEME,
): Promise<Epic> {
  const now = new Date().toISOString();
  const data = {
    name,
    description,
    colorTheme,
    isArchived: false,
    startedAt: null,
    completedAt: null,
    createdAt: now,
  };
  const ref = await epicsCollection().add(data);
  return { id: ref.id, ...data };
}

export interface UpdateEpicInput {
  name?: string;
  description?: string;
  colorTheme?: EpicColorTheme;
}

export async function updateEpic(id: string, input: UpdateEpicInput): Promise<void> {
  await epicsCollection().doc(id).update({ ...input });
}

export async function deleteEpic(id: string): Promise<void> {
  const memberTickets = await ticketsCollection().where('epicId', '==', id).get();
  const now = new Date().toISOString();
  const mutations: ((batch: WriteBatch) => void)[] = memberTickets.docs.map(
    (doc) => (batch) => batch.update(doc.ref, { epicId: null, updatedAt: now }),
  );
  mutations.push((batch) => batch.delete(epicsCollection().doc(id)));
  await commitInChunks(mutations);
}

/** Archives an epic and every ticket assigned to it, regardless of status. */
export async function archiveEpic(id: string): Promise<void> {
  const memberTickets = await ticketsCollection().where('epicId', '==', id).get();
  const now = new Date().toISOString();

  const mutations: ((batch: WriteBatch) => void)[] = [
    (batch) => batch.update(epicsCollection().doc(id), { isArchived: true, completedAt: now }),
  ];

  memberTickets.docs.forEach((doc) => {
    mutations.push((batch) => batch.update(doc.ref, { isArchived: true, updatedAt: now }));
  });

  await commitInChunks(mutations);
}

export async function getTickets(): Promise<Ticket[]> {
  const snapshot = await ticketsCollection().orderBy('createdAt', 'asc').get();

  // One-off backfill for tickets created before the `key` field existed — same lazy,
  // self-healing pattern as ensureDefaultJog. Only ever touches docs that don't have a key
  // yet, so it's a no-op once every ticket has been backfilled.
  const missingKeyDocs = snapshot.docs.filter((doc) => !doc.data().key);
  const backfilledKeys = new Map<string, string>();
  if (missingKeyDocs.length > 0) {
    const numbers = await reserveTicketKeyNumbers(missingKeyDocs.length);
    missingKeyDocs.forEach((doc, i) => backfilledKeys.set(doc.id, `T-${numbers[i]}`));
    await commitInChunks(
      missingKeyDocs.map((doc) => (batch) => batch.update(doc.ref, { key: backfilledKeys.get(doc.id) })),
    );
  }

  return snapshot.docs.map((doc) => {
    const ticket = toTicket(doc);
    const backfilledKey = backfilledKeys.get(doc.id);
    return backfilledKey ? { ...ticket, key: backfilledKey } : ticket;
  });
}

export async function getTicketByKey(key: string): Promise<Ticket | null> {
  const snapshot = await ticketsCollection().where('key', '==', key).limit(1).get();
  return snapshot.empty ? null : toTicket(snapshot.docs[0]);
}

export interface CreateTicketInput {
  title: string;
  body: string;
  acceptanceCriteria: string;
  jogId: string;
  epicId: string | null;
  priority: Priority | null;
  dueDate: string | null;
  tags: string[];
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const now = new Date().toISOString();
  const [keyNumber] = await reserveTicketKeyNumbers(1);
  const data = {
    key: `T-${keyNumber}`,
    title: input.title,
    body: input.body,
    acceptanceCriteria: input.acceptanceCriteria,
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
export async function reorderTickets(orderedIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  await commitInChunks(
    orderedIds.map(
      (id, index) => (batch) => batch.update(ticketsCollection().doc(id), { order: index * ORDER_GAP, updatedAt: now }),
    ),
  );
}

export interface UpdateTicketInput {
  title?: string;
  body?: string;
  acceptanceCriteria?: string;
  status?: TicketStatus;
  jogId?: string;
  epicId?: string | null;
  priority?: Priority | null;
  dueDate?: string | null;
  tags?: string[];
  order?: number;
  isArchived?: boolean;
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<void> {
  const now = new Date().toISOString();

  // First time any ticket in an epic moves off `todo`, stamp the epic as started.
  if (input.status && input.status !== 'todo') {
    const ticketRef = ticketsCollection().doc(id);
    const epicId = input.epicId !== undefined ? input.epicId : (await ticketRef.get()).data()?.epicId;
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

export async function deleteTicket(id: string): Promise<void> {
  await ticketsCollection().doc(id).delete();
}

export async function addComment(ticketId: string, body: string): Promise<Comment> {
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

export async function deleteComment(ticketId: string, commentId: string): Promise<void> {
  const ref = ticketsCollection().doc(ticketId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const comments: Comment[] = doc.data()?.comments ?? [];
  const remaining = comments.filter((comment) => comment.id !== commentId);
  await ref.update({ comments: remaining, updatedAt: new Date().toISOString() });
}

const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const loginAttemptsCollection = () => getFirestore().collection('loginAttempts');

function loginAttemptsDocId(ip: string): string {
  return encodeURIComponent(ip);
}

export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const doc = await loginAttemptsCollection().doc(loginAttemptsDocId(ip)).get();
  if (!doc.exists) return false;
  const data = doc.data()!;
  const windowAge = Date.now() - new Date(data.windowStart).getTime();
  if (windowAge > LOGIN_RATE_LIMIT_WINDOW_MS) return false;
  return data.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordFailedLogin(ip: string): Promise<void> {
  const ref = loginAttemptsCollection().doc(loginAttemptsDocId(ip));
  const doc = await ref.get();
  const now = new Date().toISOString();

  if (!doc.exists) {
    await ref.set({ count: 1, windowStart: now });
    return;
  }

  const data = doc.data()!;
  const windowAge = Date.now() - new Date(data.windowStart).getTime();
  if (windowAge > LOGIN_RATE_LIMIT_WINDOW_MS) {
    await ref.set({ count: 1, windowStart: now });
  } else {
    await ref.update({ count: FieldValue.increment(1) });
  }
}

export async function clearLoginAttempts(ip: string): Promise<void> {
  await loginAttemptsCollection().doc(loginAttemptsDocId(ip)).delete();
}
