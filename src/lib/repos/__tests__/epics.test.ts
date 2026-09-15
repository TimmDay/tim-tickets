import { describe, expect, it } from 'vitest';
import { createEpicsRepo } from '../epics';
import { createTicketsRepo } from '../tickets';
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

describe('epicsRepo.archiveEpic screenshots', () => {
  it("deletes member tickets' screenshots and leaves other epics' alone", async () => {
    const db = createFakeFirestore(seedFirestore());
    const tickets = createTicketsRepo(db);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await tickets.setScreenshot('t1', png, 'image/png'); // epic-a
    await tickets.setScreenshot('t4', png, 'image/png'); // epic-a
    const otherEpicTicket = (await db.collection('tickets').get()).docs.find(
      (doc) => doc.data()?.epicId && doc.data()?.epicId !== EPIC_A_ID && doc.data()?.status !== 'done',
    )!;
    await tickets.setScreenshot(otherEpicTicket.id, png, 'image/png');

    await createEpicsRepo(db).archiveEpic(EPIC_A_ID);

    for (const id of ['t1', 't4']) {
      expect(await tickets.getScreenshot(id)).toBeNull();
      expect((await db.collection('tickets').doc(id).get()).data()?.screenshot).toBeNull();
    }
    expect(await tickets.getScreenshot(otherEpicTicket.id)).not.toBeNull();
  });
});
