import { Firestore } from '@google-cloud/firestore';

export interface DocSnapshotLike {
  readonly id: string;
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface QuerySnapshotLike {
  readonly docs: DocSnapshotLike[];
  readonly empty: boolean;
}

export interface DocRefLike {
  readonly id: string;
  get(): Promise<DocSnapshotLike>;
  update(data: Record<string, unknown>): Promise<unknown>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface QueryLike {
  where(field: string, op: '==', value: unknown): QueryLike;
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryLike;
  limit(count: number): QueryLike;
  get(): Promise<QuerySnapshotLike>;
}

export interface CollectionRefLike extends QueryLike {
  doc(id?: string): DocRefLike;
  add(data: Record<string, unknown>): Promise<DocRefLike>;
}

export interface WriteBatchLike {
  update(ref: DocRefLike, data: Record<string, unknown>): WriteBatchLike;
  delete(ref: DocRefLike): WriteBatchLike;
  set(ref: DocRefLike, data: Record<string, unknown>): WriteBatchLike;
  commit(): Promise<unknown>;
}

export interface TransactionLike {
  get(ref: DocRefLike): Promise<DocSnapshotLike>;
  set(ref: DocRefLike, data: Record<string, unknown>, options?: { merge?: boolean }): TransactionLike;
  update(ref: DocRefLike, data: Record<string, unknown>): TransactionLike;
}

/**
 * The narrow slice of the Firestore client every repo actually calls. A real `Firestore`
 * instance satisfies this structurally, so production code passes it straight through; tests
 * pass a hand-rolled in-memory fake instead (see `__tests__/fakeFirestore.ts`). This interface
 * is the seam — it's what makes a repo testable without a live Firestore connection.
 */
export interface FirestoreLike {
  collection(name: string): CollectionRefLike;
  batch(): WriteBatchLike;
  runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T>;
}

let firestore: Firestore | null = null;

export function getFirestore(): FirestoreLike {
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

// Firestore hard-caps a single WriteBatch at 500 mutations. Cascade operations (archiving a
// jog/epic, bulk reorders) can exceed that over time as data accumulates, so mutations are
// queued up front and committed across as many batches as needed.
const FIRESTORE_BATCH_LIMIT = 500;

export async function commitInChunks(db: FirestoreLike, mutations: ((batch: WriteBatchLike) => void)[]): Promise<void> {
  for (let i = 0; i < mutations.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    mutations.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((mutate) => mutate(batch));
    await batch.commit();
  }
}
