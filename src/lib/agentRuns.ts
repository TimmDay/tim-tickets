import { GithubRepoRef, parseGithubRepoUrl } from './github';
import { ALL_JOGS_ID, Comment, Epic, Ticket } from './types';

/** The tag that makes a ticket eligible for agent runs (matching the board's "EH OI" button). */
export const AGENT_TAG = 'EH OI';

// Tags are freeform, so match ignoring case and runs of whitespace ("eh  oi" counts).
const normalizeTag = (tag: string) => tag.trim().replace(/\s+/g, ' ').toLowerCase();

export function hasAgentTag(tags: string[]): boolean {
  return tags.some((tag) => normalizeTag(tag) === normalizeTag(AGENT_TAG));
}
export const AGENT_DISPATCH_EVENT_TYPE = 'tim-tickets-agent';

/** Prefix of the status comments the app itself writes on agent runs. */
export const AGENT_COMMENT_PREFIX = '🤖';

// GitHub caps a repository_dispatch payload's size, so long comment histories are trimmed
// (oldest first) to keep the whole payload comfortably under it.
const MAX_AGENT_COMMENTS_LENGTH = 20_000;

/**
 * Formats a ticket's comments as prompt context for an agent: oldest first, one bullet each,
 * skipping the app's own 🤖 status comments (noise to the agent). If over the size cap, the
 * oldest comments are dropped first, since later ones tend to supersede them.
 */
export function formatCommentsForAgent(comments: Comment[]): string {
  const lines = [...comments]
    .filter((comment) => !comment.body.startsWith(AGENT_COMMENT_PREFIX))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((comment) => `- (${comment.createdAt.slice(0, 10)}) ${comment.body}`);

  let total = lines.reduce((sum, line) => sum + line.length + 1, 0);
  let dropped = 0;
  while (total > MAX_AGENT_COMMENTS_LENGTH && lines.length > 1) {
    total -= lines.shift()!.length + 1;
    dropped++;
  }
  if (dropped > 0) lines.unshift(`(${dropped} older comment${dropped === 1 ? '' : 's'} omitted)`);
  return lines.join('\n');
}

/**
 * Base URL agent workflows report back to. Normally the origin the button was pressed on (the
 * deployed app), but `override` (the AGENT_REPORT_BASE_URL env var) wins when set, e.g. a
 * tunnel URL while dispatching from local dev, where the request origin is localhost and so
 * unreachable from GitHub. Throws on an override that isn't an http(s) URL, so a typo fails the
 * whole run up front rather than every workflow failing at its final step.
 */
export function resolveReportBaseUrl(requestUrl: string, override: string | undefined): string {
  if (!override?.trim()) return new URL(requestUrl).origin;
  let url: URL;
  try {
    url = new URL(override.trim());
  } catch {
    throw new Error(`AGENT_REPORT_BASE_URL is not a valid URL: ${override}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`AGENT_REPORT_BASE_URL must be http(s): ${override}`);
  }
  return url.origin;
}

export interface AgentRunCandidate {
  ticket: Ticket;
  epic: Epic;
  repo: GithubRepoRef;
}

export interface AgentRunSelection {
  eligible: AgentRunCandidate[];
  /** Otherwise eligible, but already dispatched and not yet reported back. */
  alreadyDispatched: AgentRunCandidate[];
}

/**
 * Tickets "Release the bots" acts on: in the given jog (or any, for ALL_JOGS_ID), status todo
 * or in_progress, not archived, tagged AGENT_TAG (`EH OI`, see hasAgentTag), and in a non-archived epic with
 * a valid GitHub repo. Shared by the board's confirm dialog and the dispatch route so what you
 * confirm is what gets sent.
 */
export function selectAgentRunCandidates(tickets: Ticket[], epics: Epic[], jogId: string): AgentRunSelection {
  const epicsById = new Map(epics.map((epic) => [epic.id, epic]));
  const selection: AgentRunSelection = { eligible: [], alreadyDispatched: [] };

  for (const ticket of tickets) {
    if (jogId !== ALL_JOGS_ID && ticket.jogId !== jogId) continue;
    if (ticket.isArchived) continue;
    if (ticket.status !== 'todo' && ticket.status !== 'in_progress') continue;
    if (!hasAgentTag(ticket.tags)) continue;
    const epic = ticket.epicId ? epicsById.get(ticket.epicId) : undefined;
    if (!epic || epic.isArchived) continue;
    const repo = parseGithubRepoUrl(epic.repoUrl);
    if (!repo) continue;

    const candidate = { ticket, epic, repo };
    (ticket.agentDispatchedAt ? selection.alreadyDispatched : selection.eligible).push(candidate);
  }

  const byOrder = (a: AgentRunCandidate, b: AgentRunCandidate) => a.ticket.order - b.ticket.order;
  selection.eligible.sort(byOrder);
  selection.alreadyDispatched.sort(byOrder);
  return selection;
}

/** Where the agent workflow must live in a target repo. GitHub only runs repository_dispatch
 * workflows from the default branch, so that's where the readiness check looks. */
export const AGENT_WORKFLOW_PATH = '.github/workflows/tim-tickets-agent.yml';

/**
 * Whether a repo can actually run an agent dispatch, as far as the dispatch token can tell.
 * GitHub accepts a dispatch (204) even when no workflow listens for it, so without this check a
 * misconfigured repo fails silently. `unknown` means the check itself couldn't run (GitHub error,
 * rate limit, missing token) — treated as "don't block", since the dispatch may still work.
 * Secrets and repo settings aren't checkable with the dispatch token's permissions.
 */
export type RepoAgentReadiness =
  | { status: 'ready' }
  | { status: 'workflow_missing' }
  | { status: 'no_access' }
  | { status: 'unknown'; message: string };

/** Case-insensitive key for a repo, since GitHub owner/repo names are. */
export function repoKey(repo: GithubRepoRef): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

/**
 * Interprets the GitHub API responses behind a readiness check: the workflow file lookup, then
 * (only when that 404s) the repo itself — GitHub answers 404 both for a missing file and for a
 * repo the token can't see, so the second call tells them apart.
 */
export function interpretRepoReadiness(workflowStatus: number, repoStatus?: number): RepoAgentReadiness {
  if (workflowStatus === 200) return { status: 'ready' };
  if (workflowStatus === 404) {
    if (repoStatus === 200) return { status: 'workflow_missing' };
    if (repoStatus === 404) return { status: 'no_access' };
    return { status: 'unknown', message: `GitHub repo lookup failed (${repoStatus ?? 'no response'})` };
  }
  if (workflowStatus === 401) return { status: 'unknown', message: 'GitHub rejected the dispatch token (401)' };
  return { status: 'unknown', message: `GitHub workflow lookup failed (${workflowStatus})` };
}

export function blocksDispatch(readiness: RepoAgentReadiness | undefined): boolean {
  return readiness?.status === 'workflow_missing' || readiness?.status === 'no_access';
}

/** User-facing explanation for a repo that isn't ready; null when there's nothing to say. */
export function describeRepoReadiness(repo: GithubRepoRef, readiness: RepoAgentReadiness | undefined): string | null {
  const name = `${repo.owner}/${repo.name}`;
  switch (readiness?.status) {
    case 'workflow_missing':
      return `${name} isn't set up for agents: ${AGENT_WORKFLOW_PATH} isn't on its default branch.`;
    case 'no_access':
      return `The GitHub dispatch token can't access ${name}. Add the repo to the token, or check the epic's repo URL.`;
    default:
      return null;
  }
}

/** How long after dispatch a missing report counts as overdue: the workflow's 60-minute
 * `timeout-minutes`, plus slack for queueing and the report-back step itself. */
export const AGENT_REPORT_OVERDUE_MS = 75 * 60 * 1000;

/** True when an agent was dispatched for the ticket long enough ago that its run should have
 * reported back (which clears `agentDispatchedAt`) and hasn't. Only for tickets still in an
 * agent-eligible status: if you've since moved it on by hand (e.g. to in_review after handling a
 * failed report-back yourself), the leftover stamp isn't worth flagging. */
export function isAgentReportOverdue(ticket: Pick<Ticket, 'agentDispatchedAt' | 'status'>, nowMs: number): boolean {
  if (!ticket.agentDispatchedAt) return false;
  if (ticket.status !== 'todo' && ticket.status !== 'in_progress') return false;
  const dispatchedMs = Date.parse(ticket.agentDispatchedAt);
  return Number.isFinite(dispatchedMs) && nowMs - dispatchedMs > AGENT_REPORT_OVERDUE_MS;
}

/** "45m", "2h 5m", "3d 4h" — for "dispatched … ago" hints. */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}
