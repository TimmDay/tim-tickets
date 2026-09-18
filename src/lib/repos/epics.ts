import { DEFAULT_EPIC_COLOR_THEME, Epic, EpicColorTheme, ORDER_GAP } from '../types';
import { commitInChunks, DocSnapshotLike, FirestoreLike, WriteBatchLike } from './client';

function toEpic(doc: DocSnapshotLike): Epic {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name as string,
    description: (data.description as string) ?? '',
    colorTheme: (data.colorTheme as EpicColorTheme) ?? DEFAULT_EPIC_COLOR_THEME,
    repoUrl: (data.repoUrl as string | null) ?? null,
    isArchived: (data.isArchived as boolean) ?? false,
    startedAt: (data.startedAt as string | null) ?? null,
    completedAt: (data.completedAt as string | null) ?? null,
    createdAt: data.createdAt as string,
    order: (data.order as number) ?? new Date(data.createdAt as string).getTime(),
  };
}

export interface UpdateEpicInput {
  name?: string;
  description?: string;
  colorTheme?: EpicColorTheme;
  repoUrl?: string | null;
  order?: number;
}

export function createEpicsRepo(db: FirestoreLike) {
  const epicsCollection = () => db.collection('epics');
  // deleteEpic/archiveEpic cascade into member tickets — see tickets.ts for why this reaches
  // into the tickets collection directly rather than depending on the tickets repo.
  const ticketsCollection = () => db.collection('tickets');
  // archiveEpic discards its tickets' screenshots, same rule as archiving a ticket directly.
  const screenshotsCollection = () => db.collection('ticketScreenshots');

  async function getEpics(): Promise<Epic[]> {
    const snapshot = await epicsCollection().orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(toEpic);
  }

  async function createEpic(
    name: string,
    description: string = '',
    colorTheme: EpicColorTheme = DEFAULT_EPIC_COLOR_THEME,
    repoUrl: string | null = null,
  ): Promise<Epic> {
    const now = new Date().toISOString();
    const data = {
      name,
      description,
      colorTheme,
      repoUrl,
      isArchived: false,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      order: Date.now(),
    };
    const ref = await epicsCollection().add(data);
    return { id: ref.id, ...data };
  }

  async function updateEpic(id: string, input: UpdateEpicInput): Promise<void> {
    await epicsCollection().doc(id).update({ ...input });
  }

  /** Rebalances the given epics to evenly-spaced order values. Only needed when
   * fractional-index gaps between neighbors have collapsed too far to bisect. */
  async function reorderEpics(orderedIds: string[]): Promise<void> {
    await commitInChunks(
      db,
      orderedIds.map((id, index) => (batch) => batch.update(epicsCollection().doc(id), { order: index * ORDER_GAP })),
    );
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
      mutations.push((batch) =>
        batch.update(ticketsCollection().doc(doc.id), { isArchived: true, screenshot: null, updatedAt: now }),
      );
      if (doc.data()?.screenshot) {
        mutations.push((batch) => batch.delete(screenshotsCollection().doc(doc.id)));
      }
    });

    await commitInChunks(db, mutations);
  }

  return { getEpics, createEpic, updateEpic, reorderEpics, deleteEpic, archiveEpic };
}

export type EpicsRepo = ReturnType<typeof createEpicsRepo>;
