import { describe, expect, it } from 'vitest';
import {
  AGENT_REPORT_OVERDUE_MS,
  blocksDispatch,
  describeRepoReadiness,
  formatCommentsForAgent,
  formatElapsed,
  hasAgentTag,
  interpretRepoReadiness,
  isAgentReportOverdue,
  repoKey,
  resolveReportBaseUrl,
  selectAgentRunCandidates,
} from '../agentRuns';
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

describe('repo agent readiness', () => {
  const repo = { owner: 'TimmDay', name: 'architecture-simulator' };

  it('interprets the workflow lookup, using the repo lookup to tell a missing file from no access', () => {
    expect(interpretRepoReadiness(200)).toEqual({ status: 'ready' });
    expect(interpretRepoReadiness(404, 200)).toEqual({ status: 'workflow_missing' });
    expect(interpretRepoReadiness(404, 404)).toEqual({ status: 'no_access' });
    expect(interpretRepoReadiness(404, 500).status).toBe('unknown');
    expect(interpretRepoReadiness(401)).toEqual({ status: 'unknown', message: 'GitHub rejected the dispatch token (401)' });
    expect(interpretRepoReadiness(403).status).toBe('unknown');
  });

  it('blocks dispatch only for definite setup problems, not for failed checks', () => {
    expect(blocksDispatch({ status: 'workflow_missing' })).toBe(true);
    expect(blocksDispatch({ status: 'no_access' })).toBe(true);
    expect(blocksDispatch({ status: 'ready' })).toBe(false);
    expect(blocksDispatch({ status: 'unknown', message: 'rate limited' })).toBe(false);
    expect(blocksDispatch(undefined)).toBe(false);
  });

  it('explains setup problems and stays quiet otherwise', () => {
    expect(describeRepoReadiness(repo, { status: 'workflow_missing' })).toBe(
      "TimmDay/architecture-simulator isn't set up for agents: .github/workflows/tim-tickets-agent.yml isn't on its default branch.",
    );
    expect(describeRepoReadiness(repo, { status: 'no_access' })).toContain("can't access TimmDay/architecture-simulator");
    expect(describeRepoReadiness(repo, { status: 'ready' })).toBeNull();
    expect(describeRepoReadiness(repo, { status: 'unknown', message: 'x' })).toBeNull();
  });

  it('keys repos case-insensitively', () => {
    expect(repoKey({ owner: 'TimmDay', name: 'Tim-Tickets' })).toBe(repoKey({ owner: 'timmday', name: 'tim-tickets' }));
  });
});

describe('agent report overdue', () => {
  const now = Date.parse('2026-09-16T12:00:00.000Z');
  const dispatchedAgo = (ms: number) => ({ agentDispatchedAt: new Date(now - ms).toISOString(), status: 'in_progress' as const });

  it('is overdue only once past the threshold', () => {
    expect(isAgentReportOverdue(dispatchedAgo(AGENT_REPORT_OVERDUE_MS - 60_000), now)).toBe(false);
    expect(isAgentReportOverdue(dispatchedAgo(AGENT_REPORT_OVERDUE_MS + 60_000), now)).toBe(true);
  });

  it('is never overdue without a dispatch, or with an unparseable timestamp', () => {
    expect(isAgentReportOverdue({ agentDispatchedAt: null, status: 'in_progress' }, now)).toBe(false);
    expect(isAgentReportOverdue({ agentDispatchedAt: 'not a date', status: 'in_progress' }, now)).toBe(false);
  });

  it('is not flagged once the ticket has been moved on by hand', () => {
    const stale = dispatchedAgo(AGENT_REPORT_OVERDUE_MS * 3);
    expect(isAgentReportOverdue({ ...stale, status: 'todo' }, now)).toBe(true);
    for (const status of ['blocked', 'in_review', 'done'] as const) {
      expect(isAgentReportOverdue({ ...stale, status }, now)).toBe(false);
    }
  });

  it('formats elapsed time compactly', () => {
    expect(formatElapsed(45 * 60_000)).toBe('45m');
    expect(formatElapsed(120 * 60_000)).toBe('2h');
    expect(formatElapsed(125 * 60_000)).toBe('2h 5m');
    expect(formatElapsed(3 * 24 * 60 * 60_000 + 4 * 60 * 60_000)).toBe('3d 4h');
    expect(formatElapsed(-5)).toBe('0m');
  });
});
