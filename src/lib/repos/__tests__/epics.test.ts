import { describe, expect, it } from 'vitest';
import { ORDER_GAP } from '../../types';
import { createEpicsRepo } from '../epics';
import { createTicketsRepo } from '../tickets';
import { createFakeFirestore } from './fakeFirestore';
import { EPIC_A_ID, EPIC_B_ID, seedFirestore } from './fixtures';

describe('epicsRepo.reorderEpics', () => {
  it('rebalances the given epics to evenly-spaced order values in the given sequence', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createEpicsRepo(db);

    await repo.reorderEpics([EPIC_B_ID, EPIC_A_ID]);

    const epicBDoc = await db.collection('epics').doc(EPIC_B_ID).get();
    const epicADoc = await db.collection('epics').doc(EPIC_A_ID).get();
    expect(epicBDoc.data()?.order).toBe(0);
    expect(epicADoc.data()?.order).toBe(ORDER_GAP);
  });
});

describe('epicsRepo.completeEpic', () => {
  it('archives the epic and its done tickets, leaving unfinished tickets active in it', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createEpicsRepo(db);

    await repo.completeEpic(EPIC_A_ID);

    const epicDoc = await db.collection('epics').doc(EPIC_A_ID).get();
    expect(epicDoc.data()?.isArchived).toBe(true);
    expect(epicDoc.data()?.completedAt).toBeTruthy();

    // t8 (done) is archived.
    const t8 = await db.collection('tickets').doc('t8').get();
    expect(t8.data()?.isArchived).toBe(true);

    // t1 (todo) and t4 (in_progress) stay active and keep their epic.
    for (const id of ['t1', 't4']) {
      const doc = await db.collection('tickets').doc(id).get();
      expect(doc.data()?.isArchived).toBe(false);
      expect(doc.data()?.epicId).toBe(EPIC_A_ID);
    }

    // A ticket in a different epic is untouched.
    const t5 = await db.collection('tickets').doc('t5').get();
    expect(t5.data()?.isArchived).toBe(false);
  });

  it("leaves unfinished tickets' screenshots alone", async () => {
    const db = createFakeFirestore(seedFirestore());
    const tickets = createTicketsRepo(db);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await tickets.setScreenshot('t1', png, 'image/png'); // epic-a, todo

    await createEpicsRepo(db).completeEpic(EPIC_A_ID);

    expect(await tickets.getScreenshot('t1')).not.toBeNull();
  });
});
