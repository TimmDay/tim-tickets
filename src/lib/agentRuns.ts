import { GithubRepoRef, parseGithubRepoUrl } from './github';
import { ALL_JOGS_ID, Comment, Epic, Ticket } from './types';

export const AGENT_TAG = 'dev';
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
 * or in_progress, not archived, tagged `dev` (case-insensitive), and in a non-archived epic with
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
    if (!ticket.tags.some((tag) => tag.toLowerCase() === AGENT_TAG)) continue;
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
