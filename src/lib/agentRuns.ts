import { GithubRepoRef, parseGithubRepoUrl } from './github';
import { ALL_JOGS_ID, Epic, Ticket } from './types';

export const AGENT_TAG = 'dev';
export const AGENT_DISPATCH_EVENT_TYPE = 'tim-tickets-agent';

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
