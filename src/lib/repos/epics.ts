import { DEFAULT_EPIC_COLOR_THEME, Epic, EpicColorTheme } from '../types';
import { commitInChunks, DocSnapshotLike, FirestoreLike, WriteBatchLike } from './client';

function toEpic(doc: DocSnapshotLike): Epic {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name as string,
    description: (data.description as string) ?? '',
    colorTheme: (data.colorTheme as EpicColorTheme) ?? DEFAULT_EPIC_COLOR_THEME,
    isArchived: (data.isArchived as boolean) ?? false,
    startedAt: (data.startedAt as string | null) ?? null,
    completedAt: (data.completedAt as string | null) ?? null,
    createdAt: data.createdAt as string,
  };
}

export interface UpdateEpicInput {
  name?: string;
  description?: string;
  colorTheme?: EpicColorTheme;
}

export function createEpicsRepo(db: FirestoreLike) {
  const epicsCollection = () => db.collection('epics');
  // deleteEpic/archiveEpic cascade into member tickets — see tickets.ts for why this reaches
  // into the tickets collection directly rather than depending on the tickets repo.
  const ticketsCollection = () => db.collection('tickets');

  async function getEpics(): Promise<Epic[]> {
    const snapshot = await epicsCollection().orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(toEpic);
  }

  async function createEpic(
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

  async function updateEpic(id: string, input: UpdateEpicInput): Promise<void> {
    await epicsCollection().doc(id).update({ ...input });
  }

  async function deleteEpic(id: string): Promise<void> {
    const memberTickets = await ticketsCollection().where('epicId', '==', id).get();
    const now = new Date().toISOString();
    const mutations: ((batch: WriteBatchLike) => void)[] = memberTickets.docs.map(
      (doc) => (batch) => batch.update(ticketsCollection().doc(doc.id), { epicId: null, updatedAt: now }),
    );
    mutations.push((batch) => batch.delete(epicsCollection().doc(id)));
    await commitInChunks(db, mutations);
  }

  /** Archives an epic and every ticket assigned to it, regardless of status. */
  async function archiveEpic(id: string): Promise<void> {
    const memberTickets = await ticketsCollection().where('epicId', '==', id).get();
    const now = new Date().toISOString();

    const mutations: ((batch: WriteBatchLike) => void)[] = [
      (batch) => batch.update(epicsCollection().doc(id), { isArchived: true, completedAt: now }),
    ];

    memberTickets.docs.forEach((doc) => {
      mutations.push((batch) => batch.update(ticketsCollection().doc(doc.id), { isArchived: true, updatedAt: now }));
    });

    await commitInChunks(db, mutations);
  }

  return { getEpics, createEpic, updateEpic, deleteEpic, archiveEpic };
}

export type EpicsRepo = ReturnType<typeof createEpicsRepo>;
