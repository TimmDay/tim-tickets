// Shared seed data for repo tests: ~10 tickets spread across every status, two jogs (one
// default, one not), and two epics (one already started, one not) — enough spread to exercise
// the cascades in deleteJog/completeJog/archiveEpic/updateTicket without every test needing its
// own bespoke dataset.

export const JOG_DEFAULT_ID = 'jog-default';
export const JOG_SPRINT2_ID = 'jog-sprint2';
export const EPIC_A_ID = 'epic-a'; // not started yet
export const EPIC_B_ID = 'epic-b'; // already started

export const fixtureJogs: Record<string, Record<string, unknown>> = {
  [JOG_DEFAULT_ID]: {
    name: 'Default Jog',
    startDate: null,
    endDate: null,
    order: 0,
    isArchived: false,
    createdAt: '2025-12-01T00:00:00.000Z',
  },
  [JOG_SPRINT2_ID]: {
    name: 'Sprint 2',
    startDate: null,
    endDate: null,
    order: 1,
    isArchived: false,
    createdAt: '2025-12-15T00:00:00.000Z',
  },
};

export const fixtureEpics: Record<string, Record<string, unknown>> = {
  [EPIC_A_ID]: {
    name: 'Epic A',
    description: '',
    colorTheme: 'blue',
    isArchived: false,
    startedAt: null,
    completedAt: null,
    createdAt: '2025-12-01T00:00:00.000Z',
  },
  [EPIC_B_ID]: {
    name: 'Epic B',
    description: '',
    colorTheme: 'emerald',
    isArchived: false,
    startedAt: '2025-12-20T00:00:00.000Z',
    completedAt: null,
    createdAt: '2025-12-02T00:00:00.000Z',
  },
};

function ticket(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    title: 'Untitled',
    body: '',
    jogId: JOG_DEFAULT_ID,
    epicId: null,
    priority: null,
    dueDate: null,
    tags: [],
    comments: [],
    order: 0,
    isArchived: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const fixtureTickets: Record<string, Record<string, unknown>> = {
  t1: ticket({
    key: 'T-1',
    title: 'Design login flow',
    status: 'todo',
    jogId: JOG_SPRINT2_ID,
    epicId: EPIC_A_ID,
    order: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  t2: ticket({
    key: 'T-2',
    title: 'Write onboarding copy',
    status: 'todo',
    jogId: JOG_SPRINT2_ID,
    order: 2000,
    createdAt: '2026-01-02T00:00:00.000Z',
  }),
  t3: ticket({
    key: '',
    title: 'Old ticket missing a key',
    status: 'todo',
    jogId: JOG_DEFAULT_ID,
    order: 3000,
    createdAt: '2026-01-03T00:00:00.000Z',
  }),
  t4: ticket({
    key: 'T-4',
    title: 'Build login form',
    status: 'in_progress',
    jogId: JOG_SPRINT2_ID,
    epicId: EPIC_A_ID,
    order: 4000,
    createdAt: '2026-01-04T00:00:00.000Z',
  }),
  t5: ticket({
    key: 'T-5',
    title: 'Wire up epic B API',
    status: 'in_progress',
    jogId: JOG_DEFAULT_ID,
    epicId: EPIC_B_ID,
    order: 5000,
    createdAt: '2026-01-05T00:00:00.000Z',
  }),
  t6: ticket({
    key: 'T-6',
    title: 'Investigate flaky test',
    status: 'blocked',
    jogId: JOG_SPRINT2_ID,
    order: 6000,
    createdAt: '2026-01-06T00:00:00.000Z',
  }),
  t7: ticket({
    key: 'T-7',
    title: 'Review epic B docs',
    status: 'in_review',
    jogId: JOG_DEFAULT_ID,
    epicId: EPIC_B_ID,
    order: 7000,
    createdAt: '2026-01-07T00:00:00.000Z',
  }),
  t8: ticket({
    key: 'T-8',
    title: 'Ship login flow',
    status: 'done',
    jogId: JOG_SPRINT2_ID,
    epicId: EPIC_A_ID,
    order: 8000,
    createdAt: '2026-01-08T00:00:00.000Z',
  }),
  t9: ticket({
    key: '',
    title: 'Another old ticket missing a key',
    status: 'done',
    jogId: JOG_DEFAULT_ID,
    order: 9000,
    createdAt: '2026-01-09T00:00:00.000Z',
  }),
  t10: ticket({
    key: 'T-10',
    title: 'Retro for sprint 2',
    status: 'done',
    jogId: JOG_SPRINT2_ID,
    order: 10000,
    createdAt: '2026-01-10T00:00:00.000Z',
  }),
};

// Ticket key counter is at 10 — matches the 10 seeded tickets, so a backfill for t3/t9 (the two
// missing a key) reserves T-11 and T-12.
export const fixtureCounters: Record<string, Record<string, unknown>> = {
  tickets: { value: 10 },
};

export function seedFirestore() {
  return {
    tickets: fixtureTickets,
    jogs: fixtureJogs,
    epics: fixtureEpics,
    counters: fixtureCounters,
  };
}
