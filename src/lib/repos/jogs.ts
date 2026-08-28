import { DEFAULT_JOG_NAME, Jog, ORDER_GAP } from '../types';
import { commitInChunks, DocSnapshotLike, FirestoreLike, WriteBatchLike } from './client';

function toJog(doc: DocSnapshotLike): Jog {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name as string,
    startDate: (data.startDate as string | null) ?? null,
    endDate: (data.endDate as string | null) ?? null,
    order: (data.order as number) ?? new Date(data.createdAt as string).getTime(),
    isArchived: (data.isArchived as boolean) ?? false,
    isCurrent: (data.isCurrent as boolean) ?? false,
    createdAt: data.createdAt as string,
  };
}

export interface UpdateJogInput {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  order?: number;
  isArchived?: boolean;
}

export function createJogsRepo(db: FirestoreLike) {
  const jogsCollection = () => db.collection('jogs');
  // deleteJog/completeJog cascade into tickets that belong to the jog being removed — reached
  // into directly rather than depending on the tickets repo, for the same reason ticketsRepo
  // reaches into epics directly (see tickets.ts): not worth threading a repo-to-repo dependency
  // for a cascade this small.
  const ticketsCollection = () => db.collection('tickets');

  async function ensureDefaultJog(): Promise<Jog> {
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
      isCurrent: false,
      createdAt: now,
    };
    const ref = await jogsCollection().add(data);
    return { id: ref.id, ...data };
  }

  async function getJogs(): Promise<Jog[]> {
    await ensureDefaultJog();
    const snapshot = await jogsCollection().orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(toJog);
  }

  async function createJog(name: string, startDate: string | null = null, endDate: string | null = null): Promise<Jog> {
    const now = new Date().toISOString();
    const data = { name, startDate, endDate, order: Date.now(), isArchived: false, isCurrent: false, createdAt: now };
    const ref = await jogsCollection().add(data);
    return { id: ref.id, ...data };
  }

  /** Marks (or unmarks) a jog as the current jog. Only one jog can be current at a time,
   * so setting one clears the flag on whichever jog previously held it. The default jog
   * can't be current — it's the catch-all backlog, not a jog someone is actively working. */
  async function setCurrentJog(id: string, current: boolean): Promise<void> {
    if (current) {
      const defaultJog = await ensureDefaultJog();
      if (id === defaultJog.id) {
        throw new Error('Cannot mark the default jog as current');
      }
    }

    const newCurrentId = current ? id : null;
    const snapshot = await jogsCollection().get();
    const mutations: ((batch: WriteBatchLike) => void)[] = snapshot.docs
      .filter((doc) => Boolean(doc.data()?.isCurrent) !== (doc.id === newCurrentId))
      .map((doc) => (batch) => batch.update(jogsCollection().doc(doc.id), { isCurrent: doc.id === newCurrentId }));
    await commitInChunks(db, mutations);
  }

  /** Rebalances the given jogs to evenly-spaced order values. Only needed when
   * fractional-index gaps between neighbors have collapsed too far to bisect. */
  async function reorderJogs(orderedIds: string[]): Promise<void> {
    await commitInChunks(
      db,
      orderedIds.map((id, index) => (batch) => batch.update(jogsCollection().doc(id), { order: index * ORDER_GAP })),
    );
  }

  async function updateJog(id: string, input: UpdateJogInput): Promise<void> {
    await jogsCollection().doc(id).update({ ...input });
  }

  async function deleteJog(id: string): Promise<void> {
    const defaultJog = await ensureDefaultJog();
    if (id === defaultJog.id) {
      throw new Error('Cannot delete the default jog');
    }

    const orphaned = await ticketsCollection().where('jogId', '==', id).get();
    const now = new Date().toISOString();
    const mutations: ((batch: WriteBatchLike) => void)[] = orphaned.docs.map(
      (doc) => (batch) => batch.update(ticketsCollection().doc(doc.id), { jogId: defaultJog.id, updatedAt: now }),
    );
    mutations.push((batch) => batch.delete(jogsCollection().doc(id)));
    await commitInChunks(db, mutations);
  }

  /** Archives a jog: tickets currently in the "done" column are archived along with it,
   * everything else is moved out to the default jog so it isn't stranded on a hidden jog. */
  async function completeJog(id: string): Promise<void> {
    const defaultJog = await ensureDefaultJog();
    if (id === defaultJog.id) {
      throw new Error('Cannot complete the default jog');
    }

    const jogTickets = await ticketsCollection().where('jogId', '==', id).get();
    const now = new Date().toISOString();

    const mutations: ((batch: WriteBatchLike) => void)[] = [
      (batch) => batch.update(jogsCollection().doc(id), { isArchived: true, isCurrent: false }),
    ];

    jogTickets.docs.forEach((doc) => {
      if (doc.data()?.status === 'done') {
        mutations.push((batch) => batch.update(ticketsCollection().doc(doc.id), { isArchived: true, updatedAt: now }));
      } else {
        mutations.push((batch) => batch.update(ticketsCollection().doc(doc.id), { jogId: defaultJog.id, updatedAt: now }));
      }
    });

    await commitInChunks(db, mutations);
  }

  return { ensureDefaultJog, getJogs, createJog, reorderJogs, updateJog, deleteJog, completeJog, setCurrentJog };
}

export type JogsRepo = ReturnType<typeof createJogsRepo>;
