import { describe, expect, it } from 'vitest';
import { selectAgentRunCandidates } from '../agentRuns';
import { ALL_JOGS_ID, Epic, Ticket } from '../types';

const epic = (overrides: Partial<Epic>): Epic => ({
  id: 'e1',
  name: 'Epic',
  description: '',
  colorTheme: 'indigo',
  repoUrl: 'https://github.com/timmday/tim-tickets',
  isArchived: false,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

let nextOrder = 0;
const ticket = (overrides: Partial<Ticket>): Ticket => ({
  id: `t${nextOrder}`,
  key: `T-${nextOrder}`,
  title: 'Ticket',
  body: '',
  status: 'todo',
  jogId: 'j1',
  epicId: 'e1',
  priority: null,
  dueDate: null,
  tags: ['Dev'],
  agentModel: null,
  agentDispatchedAt: null,
  comments: [],
  order: nextOrder++,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const ids = (candidates: { ticket: Ticket }[]) => candidates.map((c) => c.ticket.id);

describe('selectAgentRunCandidates', () => {
  const epics = [epic({}), epic({ id: 'no-repo', repoUrl: null }), epic({ id: 'archived', isArchived: true })];

  it('selects dev-tagged todo/in-progress tickets in the jog whose epic has a valid repo', () => {
    const tickets = [
      ticket({ id: 'todo' }),
      ticket({ id: 'wip', status: 'in_progress', tags: ['DEV', 'Fun'] }),
      ticket({ id: 'review', status: 'in_review' }),
      ticket({ id: 'other-jog', jogId: 'j2' }),
      ticket({ id: 'no-tag', tags: ['Fun'] }),
      ticket({ id: 'no-epic', epicId: null }),
      ticket({ id: 'epic-no-repo', epicId: 'no-repo' }),
      ticket({ id: 'epic-archived', epicId: 'archived' }),
      ticket({ id: 'ticket-archived', isArchived: true }),
      ticket({ id: 'dispatched', agentDispatchedAt: '2026-09-01T00:00:00.000Z' }),
    ];

    const selection = selectAgentRunCandidates(tickets, epics, 'j1');

    expect(ids(selection.eligible)).toEqual(['todo', 'wip']);
    expect(ids(selection.alreadyDispatched)).toEqual(['dispatched']);
    expect(selection.eligible[0].repo).toEqual({ owner: 'timmday', name: 'tim-tickets' });
  });

  it('scans every jog for ALL_JOGS_ID', () => {
    const tickets = [ticket({ id: 'a', jogId: 'j1' }), ticket({ id: 'b', jogId: 'j2' })];
    expect(ids(selectAgentRunCandidates(tickets, epics, ALL_JOGS_ID).eligible)).toEqual(['a', 'b']);
  });
});
