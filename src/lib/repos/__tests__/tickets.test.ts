import { describe, expect, it } from 'vitest';
import { createTicketsRepo } from '../tickets';
import { createFakeFirestore } from './fakeFirestore';
import { EPIC_A_ID, EPIC_B_ID, seedFirestore } from './fixtures';

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

  it('returns false for an unknown key', async () => {
    const repo = createTicketsRepo(createFakeFirestore(seedFirestore()));
    expect(await repo.applyAgentReport('T-999', { outcome: 'no_changes' })).toBe(false);
  });
});
