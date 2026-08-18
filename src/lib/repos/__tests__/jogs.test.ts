import { describe, expect, it } from 'vitest';
import { createJogsRepo } from '../jogs';
import { createFakeFirestore } from './fakeFirestore';
import { JOG_DEFAULT_ID, JOG_SPRINT2_ID, seedFirestore } from './fixtures';

describe('jogsRepo.deleteJog', () => {
  it('reassigns every ticket in the deleted jog to the default jog', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await repo.deleteJog(JOG_SPRINT2_ID);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    expect(sprint2Doc.exists).toBe(false);

    // t1, t2, t4, t6, t8, t10 were all in sprint-2.
    const ticketsSnap = await db.collection('tickets').get();
    const reassigned = ticketsSnap.docs.filter((doc) => ['t1', 't2', 't4', 't6', 't8', 't10'].includes(doc.id));
    expect(reassigned).toHaveLength(6);
    for (const doc of reassigned) {
      expect(doc.data()?.jogId).toBe(JOG_DEFAULT_ID);
    }
  });
});

describe('jogsRepo.completeJog', () => {
  it('archives done tickets and reassigns everything else to the default jog', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await repo.completeJog(JOG_SPRINT2_ID);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    expect(sprint2Doc.data()?.isArchived).toBe(true);

    // t8 and t10 were done -> archived, stay in sprint-2.
    for (const id of ['t8', 't10']) {
      const doc = await db.collection('tickets').doc(id).get();
      expect(doc.data()?.isArchived).toBe(true);
      expect(doc.data()?.jogId).toBe(JOG_SPRINT2_ID);
    }

    // t1, t2, t4, t6 were not done -> moved to the default jog, not archived.
    for (const id of ['t1', 't2', 't4', 't6']) {
      const doc = await db.collection('tickets').doc(id).get();
      expect(doc.data()?.jogId).toBe(JOG_DEFAULT_ID);
      expect(doc.data()?.isArchived).toBe(false);
    }
  });
});
