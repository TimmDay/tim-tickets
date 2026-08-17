import { describe, expect, it } from 'vitest';
import { createEpicsRepo } from '../epics';
import { createFakeFirestore } from './fakeFirestore';
import { EPIC_A_ID, seedFirestore } from './fixtures';

describe('epicsRepo.archiveEpic', () => {
  it('archives the epic and every member ticket, regardless of status', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createEpicsRepo(db);

    await repo.archiveEpic(EPIC_A_ID);

    const epicDoc = await db.collection('epics').doc(EPIC_A_ID).get();
    expect(epicDoc.data()?.isArchived).toBe(true);
    expect(epicDoc.data()?.completedAt).toBeTruthy();

    // t1 (todo), t4 (in_progress), t8 (done) are all epic-a — every status archived.
    for (const id of ['t1', 't4', 't8']) {
      const doc = await db.collection('tickets').doc(id).get();
      expect(doc.data()?.isArchived).toBe(true);
    }

    // A ticket in a different epic is untouched.
    const t5 = await db.collection('tickets').doc('t5').get();
    expect(t5.data()?.isArchived).toBe(false);
  });
});
