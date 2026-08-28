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

  it('clears isCurrent on the jog it archives', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await repo.setCurrentJog(JOG_SPRINT2_ID, true);
    await repo.completeJog(JOG_SPRINT2_ID);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    expect(sprint2Doc.data()?.isCurrent).toBe(false);
  });
});

describe('jogsRepo.setCurrentJog', () => {
  it('marks the given jog current and leaves others untouched', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await repo.setCurrentJog(JOG_SPRINT2_ID, true);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    const defaultDoc = await db.collection('jogs').doc(JOG_DEFAULT_ID).get();
    expect(sprint2Doc.data()?.isCurrent).toBe(true);
    expect(defaultDoc.data()?.isCurrent).toBeFalsy();
  });

  it('only one jog can be current at a time — marking a new one clears the old one', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);
    const sprint3 = await repo.createJog('Sprint 3');

    await repo.setCurrentJog(JOG_SPRINT2_ID, true);
    await repo.setCurrentJog(sprint3.id, true);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    const sprint3Doc = await db.collection('jogs').doc(sprint3.id).get();
    expect(sprint2Doc.data()?.isCurrent).toBe(false);
    expect(sprint3Doc.data()?.isCurrent).toBe(true);
  });

  it('unsets isCurrent when passed false', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await repo.setCurrentJog(JOG_SPRINT2_ID, true);
    await repo.setCurrentJog(JOG_SPRINT2_ID, false);

    const sprint2Doc = await db.collection('jogs').doc(JOG_SPRINT2_ID).get();
    expect(sprint2Doc.data()?.isCurrent).toBe(false);
  });

  it('rejects marking the default jog as current', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createJogsRepo(db);

    await expect(repo.setCurrentJog(JOG_DEFAULT_ID, true)).rejects.toThrow('Cannot mark the default jog as current');
  });
});
