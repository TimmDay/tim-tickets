import { Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';
import { DEFAULT_JOG_NAME, Jog, Priority, Ticket, TicketStatus } from './types';

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
    priority: data.priority,
    dueDate: data.dueDate ?? null,
    tags: data.tags ?? [],
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
  const data = { name: DEFAULT_JOG_NAME, startDate: null, endDate: null, createdAt: now };
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
  const data = { name, startDate, endDate, createdAt: now };
  const ref = await jogsCollection().add(data);
  return { id: ref.id, ...data };
}

export async function getTickets(): Promise<Ticket[]> {
  const snapshot = await ticketsCollection().orderBy('createdAt', 'asc').get();
  return snapshot.docs.map(toTicket);
}

export interface CreateTicketInput {
  title: string;
  body: string;
  jogId: string;
  priority: Priority;
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
    createdAt: now,
    updatedAt: now,
  };
  const ref = await ticketsCollection().add(data);
  return { id: ref.id, ...data };
}

export interface UpdateTicketInput {
  title?: string;
  body?: string;
  status?: TicketStatus;
  jogId?: string;
  priority?: Priority;
  dueDate?: string | null;
  tags?: string[];
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<void> {
  await ticketsCollection()
    .doc(id)
    .update({ ...input, updatedAt: new Date().toISOString() });
}

export async function deleteTicket(id: string): Promise<void> {
  await ticketsCollection().doc(id).delete();
}
