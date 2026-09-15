import { describe, expect, it } from 'vitest';
import { formatCommentsForAgent, hasAgentTag, resolveReportBaseUrl, selectAgentRunCandidates } from '../agentRuns';
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
  tags: ['EH OI'],
  agentModel: null,
  agentDispatchedAt: null,
  screenshot: null,
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

  it('selects EH OI-tagged todo/in-progress tickets in the jog whose epic has a valid repo', () => {
    const tickets = [
      ticket({ id: 'todo' }),
      ticket({ id: 'wip', status: 'in_progress', tags: ['eh oi', 'Fun'] }),
      ticket({ id: 'review', status: 'in_review' }),
      ticket({ id: 'other-jog', jogId: 'j2' }),
      ticket({ id: 'no-tag', tags: ['Fun'] }),
      ticket({ id: 'dev-tag', tags: ['Dev'] }),
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

describe('formatCommentsForAgent', () => {
  const comment = (body: string, createdAt: string) => ({ id: body, body, createdAt });

  it('lists comments oldest first, skipping the app\'s own agent status comments', () => {
    const result = formatCommentsForAgent([
      comment('Use the existing modal', '2026-09-03T10:00:00.000Z'),
      comment('🤖 Agent dispatched to o/r (Default)', '2026-09-04T10:00:00.000Z'),
      comment('Needs a migration', '2026-09-01T10:00:00.000Z'),
    ]);
    expect(result).toBe('- (2026-09-01) Needs a migration\n- (2026-09-03) Use the existing modal');
  });

  it('returns an empty string when there is nothing to pass on', () => {
    expect(formatCommentsForAgent([])).toBe('');
  });

  it('drops the oldest comments first when over the size cap', () => {
    const long = 'x'.repeat(15_000);
    const result = formatCommentsForAgent([
      comment(`old ${long}`, '2026-09-01T00:00:00.000Z'),
      comment(`new ${long}`, '2026-09-02T00:00:00.000Z'),
    ]);
    expect(result.startsWith('(1 older comment omitted)\n- (2026-09-02) new ')).toBe(true);
  });
});

describe('resolveReportBaseUrl', () => {
  const requestUrl = 'http://localhost:3000/api/agent-runs';

  it('uses the request origin when no override is set', () => {
    expect(resolveReportBaseUrl(requestUrl, undefined)).toBe('http://localhost:3000');
    expect(resolveReportBaseUrl(requestUrl, '  ')).toBe('http://localhost:3000');
  });

  it('prefers the override, reduced to its origin', () => {
    expect(resolveReportBaseUrl(requestUrl, 'https://abc.trycloudflare.com/')).toBe('https://abc.trycloudflare.com');
  });

  it('rejects an override that is not an http(s) URL', () => {
    expect(() => resolveReportBaseUrl(requestUrl, 'abc.trycloudflare.com')).toThrow('AGENT_REPORT_BASE_URL');
    expect(() => resolveReportBaseUrl(requestUrl, 'ftp://example.com')).toThrow('must be http(s)');
  });
});

describe('hasAgentTag', () => {
  it('matches EH OI ignoring case and extra whitespace', () => {
    expect(hasAgentTag(['EH OI'])).toBe(true);
    expect(hasAgentTag(['Fun', ' eh   oi '])).toBe(true);
  });

  it('does not match other tags, including the old Dev trigger', () => {
    expect(hasAgentTag(['Dev'])).toBe(false);
    expect(hasAgentTag(['EHOI', 'EH OII'])).toBe(false);
    expect(hasAgentTag([])).toBe(false);
  });
});
