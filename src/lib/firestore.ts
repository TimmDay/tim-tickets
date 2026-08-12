import { FieldValue, Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';
import { Comment, DEFAULT_JOG_NAME, Jog, ORDER_GAP, Priority, Ticket, TicketStatus } from './types';

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

function toTicket(doc: QueryDocumentSnapshot): Ticket {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    body: data.body,
    status: data.status,
    jogId: data.jogId,
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
  const batch = getFirestore().batch();
  orderedIds.forEach((id, index) => {
    batch.update(jogsCollection().doc(id), { order: index * ORDER_GAP });
  });
  await batch.commit();
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
  const batch = getFirestore().batch();
  const now = new Date().toISOString();
  orphaned.docs.forEach((doc) => {
    batch.update(doc.ref, { jogId: defaultJog.id, updatedAt: now });
  });
  batch.delete(jogsCollection().doc(id));
  await batch.commit();
}

/** Archives a jog: tickets currently in the "done" column are archived along with it,
 * everything else is moved out to the default jog so it isn't stranded on a hidden jog. */
export async function completeJog(id: string): Promise<void> {
  const defaultJog = await ensureDefaultJog();
  if (id === defaultJog.id) {
    throw new Error('Cannot complete the default jog');
  }

  const jogTickets = await ticketsCollection().where('jogId', '==', id).get();
  const batch = getFirestore().batch();
  const now = new Date().toISOString();

  batch.update(jogsCollection().doc(id), { isArchived: true });

  jogTickets.docs.forEach((doc) => {
    if (doc.data().status === 'done') {
      batch.update(doc.ref, { isArchived: true, updatedAt: now });
    } else {
      batch.update(doc.ref, { jogId: defaultJog.id, updatedAt: now });
    }
  });

  await batch.commit();
}

export async function getTickets(): Promise<Ticket[]> {
  const snapshot = await ticketsCollection().orderBy('createdAt', 'asc').get();
  return snapshot.docs.map(toTicket);
}

export interface CreateTicketInput {
  title: string;
  body: string;
  jogId: string;
  priority: Priority | null;
  dueDate: string | null;
  tags: string[];
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const now = new Date().toISOString();
  const data = {
    title: input.title,
    body: input.body,
    status: 'todo' as TicketStatus,
    jogId: input.jogId,
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
  const batch = getFirestore().batch();
  const now = new Date().toISOString();
  orderedIds.forEach((id, index) => {
    batch.update(ticketsCollection().doc(id), { order: index * ORDER_GAP, updatedAt: now });
  });
  await batch.commit();
}

export interface UpdateTicketInput {
  title?: string;
  body?: string;
  status?: TicketStatus;
  jogId?: string;
  priority?: Priority | null;
  dueDate?: string | null;
  tags?: string[];
  order?: number;
  isArchived?: boolean;
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<void> {
  await ticketsCollection()
    .doc(id)
    .update({ ...input, updatedAt: new Date().toISOString() });
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
