import type {
  CollectionRefLike,
  DocRefLike,
  DocSnapshotLike,
  FirestoreLike,
  QueryLike,
  QuerySnapshotLike,
  TransactionLike,
  WriteBatchLike,
} from '../client';

type DocData = Record<string, unknown>;

/**
 * A minimal in-memory `FirestoreLike` implementation, scoped to exactly what the repos in
 * `src/lib/repos/` call — a single `==` filter, single-field `orderBy`, `limit`, batched writes,
 * and a transaction whose reads/writes apply immediately (no concurrency to simulate in a single
 * test). Not a general Firestore emulator; extend it if a future repo needs more.
 */
export function createFakeFirestore(seed: Record<string, Record<string, DocData>> = {}): FirestoreLike {
  const store = new Map<string, Map<string, DocData>>();
  for (const [collectionName, docs] of Object.entries(seed)) {
    store.set(collectionName, new Map(Object.entries(docs).map(([id, data]) => [id, { ...data }])));
  }

  function getCollectionMap(name: string): Map<string, DocData> {
    let coll = store.get(name);
    if (!coll) {
      coll = new Map();
      store.set(name, coll);
    }
    return coll;
  }

  let nextId = 1;
  function makeId(): string {
    return `fake-${nextId++}`;
  }

  function makeDocSnapshot(name: string, id: string): DocSnapshotLike {
    return {
      id,
      get exists() {
        return getCollectionMap(name).has(id);
      },
      data: () => {
        const doc = getCollectionMap(name).get(id);
        return doc ? { ...doc } : undefined;
      },
    };
  }

  function makeDocRef(name: string, id: string): DocRefLike {
    return {
      id,
      async get() {
        return makeDocSnapshot(name, id);
      },
      async update(data) {
        const coll = getCollectionMap(name);
        const existing = coll.get(id);
        if (!existing) throw new Error(`fakeFirestore: update() on missing doc ${name}/${id}`);
        coll.set(id, { ...existing, ...data });
      },
      async set(data, options) {
        const coll = getCollectionMap(name);
        coll.set(id, options?.merge ? { ...(coll.get(id) ?? {}), ...data } : { ...data });
      },
      async delete() {
        getCollectionMap(name).delete(id);
      },
    };
  }

  function makeQuery(
    name: string,
    filters: Array<(doc: DocData) => boolean>,
    sort?: { field: string; direction: 'asc' | 'desc' },
    limitCount?: number,
  ): QueryLike {
    return {
      where(field, op, value) {
        if (op !== '==') throw new Error(`fakeFirestore: unsupported operator "${op}"`);
        return makeQuery(name, [...filters, (doc) => doc[field] === value], sort, limitCount);
      },
      orderBy(field, direction = 'asc') {
        return makeQuery(name, filters, { field, direction }, limitCount);
      },
      limit(count) {
        return makeQuery(name, filters, sort, count);
      },
      async get(): Promise<QuerySnapshotLike> {
        const coll = getCollectionMap(name);
        let entries = Array.from(coll.keys()).filter((id) => filters.every((matches) => matches(coll.get(id)!)));
        if (sort) {
          const dir = sort.direction === 'desc' ? -1 : 1;
          entries = entries.sort((idA, idB) => {
            const a = coll.get(idA)![sort.field] as string | number;
            const b = coll.get(idB)![sort.field] as string | number;
            return a < b ? -dir : a > b ? dir : 0;
          });
        }
        if (limitCount !== undefined) entries = entries.slice(0, limitCount);
        const docs = entries.map((id) => makeDocSnapshot(name, id));
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  function makeCollection(name: string): CollectionRefLike {
    return {
      ...makeQuery(name, []),
      doc(id) {
        return makeDocRef(name, id ?? makeId());
      },
      async add(data) {
        const id = makeId();
        getCollectionMap(name).set(id, { ...data });
        return makeDocRef(name, id);
      },
    };
  }

  return {
    collection(name) {
      return makeCollection(name);
    },
    batch() {
      const ops: Array<() => Promise<unknown>> = [];
      const batch: WriteBatchLike = {
        update(ref, data) {
          ops.push(() => ref.update(data));
          return batch;
        },
        delete(ref) {
          ops.push(() => ref.delete());
          return batch;
        },
        set(ref, data) {
          ops.push(() => ref.set(data));
          return batch;
        },
        async commit() {
          for (const op of ops) await op();
        },
      };
      return batch;
    },
    async runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T> {
      const tx: TransactionLike = {
        get(ref) {
          return ref.get();
        },
        set(ref, data, options) {
          void ref.set(data, options);
          return tx;
        },
        update(ref, data) {
          void ref.update(data);
          return tx;
        },
      };
      return fn(tx);
    },
  };
}
