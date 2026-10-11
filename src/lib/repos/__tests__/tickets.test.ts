import { describe, expect, it } from 'vitest';
import { createTicketsRepo } from '../tickets';
import { createFakeFirestore } from './fakeFirestore';
import { EPIC_A_ID, EPIC_B_ID, JOG_SPRINT2_ID, seedFirestore } from './fixtures';

describe('ticketsRepo.getTickets', () => {
  it('backfills a missing key exactly once, without touching tickets that already have one', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);

    const tickets = await repo.getTickets();

    const t3 = tickets.find((t) => t.id === 't3')!;
    const t9 = tickets.find((t) => t.id === 't9')!;
    const t1 = tickets.find((t) => t.id === 't1')!;
    expect(t3.key).toBe('T-11');
    expect(t9.key).toBe('T-12');
    expect(t1.key).toBe('T-1'); // already had one, untouched

    // Backfill is persisted, not just returned — a second read sees the same keys, not new ones.
    const again = await repo.getTickets();
    expect(again.find((t) => t.id === 't3')!.key).toBe('T-11');
    expect(again.find((t) => t.id === 't9')!.key).toBe('T-12');
  });
});

describe('ticketsRepo.getTickets({ includeArchived: false })', () => {
  const doc = (overrides: Record<string, unknown>) => ({
    key: 'T-0',
    title: 'x',
    body: '',
    status: 'todo',
    jogId: 'jog',
    tags: [],
    comments: [],
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('leaves archived tickets out and keeps oldest-first order', async () => {
    const db = createFakeFirestore({
      tickets: {
        late: doc({ key: 'T-2', isArchived: false, createdAt: '2026-02-01T00:00:00.000Z' }),
        archived: doc({ key: 'T-3', isArchived: true, createdAt: '2026-01-15T00:00:00.000Z' }),
        early: doc({ key: 'T-1', isArchived: false, createdAt: '2026-01-01T00:00:00.000Z' }),
      },
    });
    const repo = createTicketsRepo(db);

    const tickets = await repo.getTickets({ includeArchived: false });

    expect(tickets.map((t) => t.id)).toEqual(['early', 'late']);
  });

  it('sees legacy tickets with no isArchived field once an unfiltered read has backfilled them', async () => {
    const db = createFakeFirestore({
      tickets: { legacy: doc({ key: 'T-1', createdAt: '2026-01-01T00:00:00.000Z' }) },
    });
    const repo = createTicketsRepo(db);

    expect(await repo.getTickets({ includeArchived: false })).toEqual([]);
    await repo.getTickets();
    expect((await repo.getTickets({ includeArchived: false })).map((t) => t.id)).toEqual(['legacy']);
  });
});

describe('ticketsRepo.updateTicket', () => {
  it("stamps the parent epic's startedAt the first time a ticket leaves todo, and only that once", async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);

    // t1 belongs to epic-a, which hasn't started yet.
    await repo.updateTicket('t1', { status: 'in_progress' });
    const epicASnap = await db.collection('epics').doc(EPIC_A_ID).get();
    expect(epicASnap.data()?.startedAt).toBeTruthy();
    const stampedAt = epicASnap.data()?.startedAt;

    // A second ticket in the same epic moving off todo must not re-stamp it.
    await repo.updateTicket('t4', { status: 'in_progress' });
    const epicAAfter = await db.collection('epics').doc(EPIC_A_ID).get();
    expect(epicAAfter.data()?.startedAt).toBe(stampedAt);

    // epic-b already has a startedAt in the fixture — moving one of its tickets must not touch it.
    const epicBBefore = await db.collection('epics').doc(EPIC_B_ID).get();
    await repo.updateTicket('t5', { status: 'blocked' });
    const epicBAfter = await db.collection('epics').doc(EPIC_B_ID).get();
    expect(epicBAfter.data()?.startedAt).toBe(epicBBefore.data()?.startedAt);
  });
});

describe('ticketsRepo.updateTicket result', () => {
  it('returns the saved ticket, with the screenshot cleared when archiving', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await repo.setScreenshot('t2', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');

    const { ticket } = await repo.updateTicket('t2', { isArchived: true });

    expect(ticket).toMatchObject({ id: 't2', key: 'T-2', isArchived: true, screenshot: null });
  });

  it('says whether the update started its epic', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);

    expect((await repo.updateTicket('t1', { status: 'in_progress' })).epicStarted).toBe(true);
    expect((await repo.updateTicket('t4', { status: 'blocked' })).epicStarted).toBe(false);
    expect((await repo.updateTicket('t2', { title: 'Renamed' })).epicStarted).toBe(false);
  });
});

describe('ticketsRepo.recordDispatch', () => {
  const repo = { owner: 'o', name: 'r' };

  it('stamps the dispatch, moves todo to in_progress and comments where it went', async () => {
    const db = createFakeFirestore(seedFirestore());
    await db.collection('tickets').doc('t1').update({ agentModel: 'claude-sonnet-5' });

    await createTicketsRepo(db).recordDispatch('t1', { repo, requestOpusReview: false });

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.agentDispatchedAt).toBeTruthy();
    expect(t1.status).toBe('in_progress');
    expect(t1.comments).toEqual([expect.objectContaining({ body: '🤖 Agent dispatched to o/r (Sonnet 5)' })]);
  });

  it('leaves a ticket already in progress where it is, and keeps its earlier comments', async () => {
    const db = createFakeFirestore(seedFirestore());
    const earlier = { id: 'c1', body: 'earlier', createdAt: '2026-01-01T00:00:00.000Z' };
    await db.collection('tickets').doc('t4').update({ comments: [earlier] });

    await createTicketsRepo(db).recordDispatch('t4', { repo, requestOpusReview: true });

    const t4 = (await db.collection('tickets').doc('t4').get()).data()!;
    expect(t4.status).toBe('in_progress');
    expect(t4.comments).toEqual([
      earlier,
      expect.objectContaining({ body: '🤖 Agent dispatched to o/r (default model), Opus review requested' }),
    ]);
  });

  it('moves the ticket into the target jog only when asked to', async () => {
    const db = createFakeFirestore(seedFirestore());
    const tickets = createTicketsRepo(db);

    await tickets.recordDispatch('t3', { repo, requestOpusReview: false, moveTo: { jogId: JOG_SPRINT2_ID, order: 42 } });
    await tickets.recordDispatch('t2', { repo, requestOpusReview: false });

    const t3 = (await db.collection('tickets').doc('t3').get()).data()!;
    expect(t3.jogId).toBe(JOG_SPRINT2_ID);
    expect(t3.order).toBe(42);
    const t2 = (await db.collection('tickets').doc('t2').get()).data()!;
    expect(t2.jogId).toBe(JOG_SPRINT2_ID);
    expect(t2.order).toBe(2000);
  });

  it("stamps the epic's startedAt when the dispatch moves its first ticket off todo", async () => {
    const db = createFakeFirestore(seedFirestore());

    await createTicketsRepo(db).recordDispatch('t1', { repo, requestOpusReview: false });

    expect((await db.collection('epics').doc(EPIC_A_ID).get()).data()?.startedAt).toBeTruthy();
  });

  it("leaves the epic alone when the ticket was already off todo", async () => {
    const db = createFakeFirestore(seedFirestore());
    await db.collection('tickets').doc('t1').update({ status: 'blocked' });

    await createTicketsRepo(db).recordDispatch('t1', { repo, requestOpusReview: false });

    expect((await db.collection('epics').doc(EPIC_A_ID).get()).data()?.startedAt).toBeNull();
    expect((await db.collection('tickets').doc('t1').get()).data()?.status).toBe('blocked');
  });
});

describe('ticketsRepo.applyAgentReport', () => {
  it('moves the ticket to in_review, comments the PR link and clears the dispatch stamp when a PR is opened', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await db.collection('tickets').doc('t1').update({ status: 'in_progress', agentDispatchedAt: '2026-09-01T00:00:00.000Z' });

    expect(await repo.applyAgentReport('T-1', { outcome: 'pr_opened', prUrl: 'https://github.com/o/r/pull/7' })).toBe(true);

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.status).toBe('in_review');
    expect(t1.agentDispatchedAt).toBeNull();
    expect(t1.comments).toEqual([expect.objectContaining({ body: '🤖 Agent opened a PR: https://github.com/o/r/pull/7' })]);
  });

  it('leaves status alone but still comments and clears the stamp on a failed run', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await db.collection('tickets').doc('t1').update({ status: 'in_progress', agentDispatchedAt: '2026-09-01T00:00:00.000Z' });

    await repo.applyAgentReport('T-1', { outcome: 'failed', runUrl: 'https://github.com/o/r/actions/runs/1' });

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.status).toBe('in_progress');
    expect(t1.agentDispatchedAt).toBeNull();
    expect(t1.comments).toEqual([
      expect.objectContaining({ body: '🤖 Agent run failed: https://github.com/o/r/actions/runs/1' }),
    ]);
  });

  it('moves the ticket to done and comments when its agent PR is merged', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await db.collection('tickets').doc('t1').update({ status: 'in_review' });

    await repo.applyAgentReport('T-1', { outcome: 'merged', prUrl: 'https://github.com/o/r/pull/7' });

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.status).toBe('done');
    expect(t1.comments).toEqual([expect.objectContaining({ body: '🤖 Agent PR merged: https://github.com/o/r/pull/7' })]);
  });

  it('moves the ticket to blocked with the agent\'s reason when the work is already done', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await db.collection('tickets').doc('t1').update({ status: 'in_progress', agentDispatchedAt: '2026-09-01T00:00:00.000Z' });

    await repo.applyAgentReport('T-1', {
      outcome: 'already_done',
      reason: 'The tag order is already set in BASE_TAGS.',
      runUrl: 'https://github.com/o/r/actions/runs/9',
    });

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.status).toBe('blocked');
    expect(t1.agentDispatchedAt).toBeNull();
    expect(t1.comments).toEqual([
      expect.objectContaining({
        body: '🤖 It seems these changes have already been made: The tag order is already set in BASE_TAGS.\n\nAgent run: https://github.com/o/r/actions/runs/9',
      }),
    ]);
  });

  it('still comments sensibly when the agent gives no reason', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);

    await repo.applyAgentReport('T-1', { outcome: 'already_done' });

    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.status).toBe('blocked');
    expect(t1.comments).toEqual([expect.objectContaining({ body: '🤖 It seems these changes have already been made.' })]);
  });

  it('returns false for an unknown key', async () => {
    const repo = createTicketsRepo(createFakeFirestore(seedFirestore()));
    expect(await repo.applyAgentReport('T-999', { outcome: 'no_changes' })).toBe(false);
  });
});

describe('ticket screenshots', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

  async function withScreenshot() {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    const meta = await repo.setScreenshot('t1', png, 'image/png');
    return { db, repo, meta };
  }

  it('stores the bytes separately and records metadata on the ticket', async () => {
    const { db, repo, meta } = await withScreenshot();

    expect(meta).toMatchObject({ contentType: 'image/png', size: png.length });
    expect((await db.collection('tickets').doc('t1').get()).data()!.screenshot).toEqual(meta);
    expect(await repo.getScreenshot('t1')).toEqual({ data: png, contentType: 'image/png' });
  });

  it('returns null when setting a screenshot on a missing ticket', async () => {
    const repo = createTicketsRepo(createFakeFirestore(seedFirestore()));
    expect(await repo.setScreenshot('nope', png, 'image/png')).toBeNull();
    expect(await repo.getScreenshot('nope')).toBeNull();
  });

  it('refuses a screenshot for a done ticket', async () => {
    const db = createFakeFirestore(seedFirestore());
    const repo = createTicketsRepo(db);
    await repo.updateTicket('t1', { status: 'done' });

    expect(await repo.setScreenshot('t1', png, 'image/png')).toBeNull();
    expect(await repo.getScreenshot('t1')).toBeNull();
  });

  it('deletes the screenshot when the ticket moves to done, but not on other status changes', async () => {
    const { db, repo } = await withScreenshot();

    await repo.updateTicket('t1', { status: 'in_progress' });
    expect(await repo.getScreenshot('t1')).not.toBeNull();

    await repo.updateTicket('t1', { status: 'done' });
    expect(await repo.getScreenshot('t1')).toBeNull();
    const t1 = (await db.collection('tickets').doc('t1').get()).data()!;
    expect(t1.screenshot).toBeNull();
    expect(t1.status).toBe('done');
  });

  it('deletes the screenshot when a merged agent PR moves the ticket to done', async () => {
    const { db, repo } = await withScreenshot();

    await repo.applyAgentReport('T-1', { outcome: 'pr_opened', prUrl: 'https://github.com/o/r/pull/1' });
    expect(await repo.getScreenshot('t1')).not.toBeNull();

    await repo.applyAgentReport('T-1', { outcome: 'merged', prUrl: 'https://github.com/o/r/pull/1' });
    expect(await repo.getScreenshot('t1')).toBeNull();
    expect((await db.collection('tickets').doc('t1').get()).data()!.screenshot).toBeNull();
  });

  it('deletes the screenshot when the ticket is archived, and refuses new ones while archived', async () => {
    const { db, repo } = await withScreenshot();

    await repo.updateTicket('t1', { isArchived: true });

    expect(await repo.getScreenshot('t1')).toBeNull();
    expect((await db.collection('tickets').doc('t1').get()).data()!.screenshot).toBeNull();
    expect(await repo.setScreenshot('t1', png, 'image/png')).toBeNull();
  });

  it('deletes the screenshot along with the ticket', async () => {
    const { db, repo } = await withScreenshot();

    await repo.deleteTicket('t1');

    expect((await db.collection('tickets').doc('t1').get()).exists).toBe(false);
    expect(await repo.getScreenshot('t1')).toBeNull();
  });

  it('removes a screenshot on request', async () => {
    const { db, repo } = await withScreenshot();

    await repo.deleteScreenshot('t1');

    expect(await repo.getScreenshot('t1')).toBeNull();
    expect((await db.collection('tickets').doc('t1').get()).data()!.screenshot).toBeNull();
  });
});
