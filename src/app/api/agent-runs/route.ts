import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AGENT_COMMENT_PREFIX,
  AGENT_DISPATCH_EVENT_TYPE,
  formatCommentsForAgent,
  resolveReportBaseUrl,
  selectAgentRunCandidates,
} from '@/lib/agentRuns';
import { toGithubRepoUrl } from '@/lib/github';
import { sendRepositoryDispatch } from '@/lib/githubDispatch';
import { epicsRepo, ticketsRepo } from '@/lib/repos';
import { ALL_JOGS_ID, AGENT_MODELS } from '@/lib/types';

const agentRunSchema = z.object({
  jogId: z.string().min(1),
  /** Also re-dispatch tickets that already have a run in flight. */
  includeDispatched: z.boolean().default(false),
  /** Include tickets from backlog (all jogs) in addition to the selected jog. */
  includeBacklog: z.boolean().default(false),
  /** IDs of specific tickets to dispatch (subset of eligible). */
  selectedIds: z.array(z.string()).default([]),
});

/** "Release the bots": dispatches a GitHub workflow run for every eligible ticket in the jog. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = agentRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [tickets, epics] = await Promise.all([ticketsRepo.getTickets(), epicsRepo.getEpics()]);
  const selection = selectAgentRunCandidates(tickets, epics, parsed.data.jogId);

  let allCandidates = parsed.data.includeDispatched
    ? [...selection.eligible, ...selection.alreadyDispatched]
    : selection.eligible;

  if (parsed.data.includeBacklog && parsed.data.jogId !== ALL_JOGS_ID) {
    const backlogSelection = selectAgentRunCandidates(tickets, epics, ALL_JOGS_ID);
    const backlogCandidates = parsed.data.includeDispatched
      ? [...backlogSelection.eligible, ...backlogSelection.alreadyDispatched]
      : backlogSelection.eligible;
    // Add backlog tickets that aren't already in the selection
    const existingIds = new Set(allCandidates.map((c) => c.ticket.id));
    allCandidates = [...allCandidates, ...backlogCandidates.filter((c) => !existingIds.has(c.ticket.id))];
  }

  const selectedIdSet = new Set(parsed.data.selectedIds);
  const candidates = selectedIdSet.size > 0 ? allCandidates.filter((c) => selectedIdSet.has(c.ticket.id)) : allCandidates;

  // The agent's workflow posts its result back here, so it must be reachable from GitHub — the
  // deployed app, or AGENT_REPORT_BASE_URL (e.g. a tunnel) when dispatching from local dev.
  let reportBaseUrl: string;
  try {
    reportBaseUrl = resolveReportBaseUrl(request.url, process.env.AGENT_REPORT_BASE_URL);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  const results = await Promise.all(
    candidates.map(async ({ ticket, epic, repo }) => {
      try {
        await sendRepositoryDispatch(repo, AGENT_DISPATCH_EVENT_TYPE, {
          ticketKey: ticket.key,
          title: ticket.title,
          body: ticket.body,
          // Wider context: the feature this ticket is part of, and any clarifications in comments.
          epicName: epic.name,
          epicDescription: epic.description,
          comments: formatCommentsForAgent(ticket.comments),
          model: ticket.agentModel ?? '',
          reportUrl: `${reportBaseUrl}/api/agent/tickets/${ticket.key}/report`,
        });
      } catch (error) {
        return { key: ticket.key, ok: false as const, error: error instanceof Error ? error.message : String(error) };
      }

      const now = new Date().toISOString();
      const modelLabel = AGENT_MODELS.find((m) => m.value === ticket.agentModel)?.label ?? 'default model';
      await ticketsRepo.updateTicket(ticket.id, {
        agentDispatchedAt: now,
        ...(ticket.status === 'todo' ? { status: 'in_progress' as const } : {}),
      });
      await ticketsRepo.addComment(
        ticket.id,
        `${AGENT_COMMENT_PREFIX} Agent dispatched to ${toGithubRepoUrl(repo).replace('https://github.com/', '')} (${modelLabel})`,
      );
      return { key: ticket.key, ok: true as const };
    }),
  );

  return NextResponse.json({
    dispatched: results.filter((r) => r.ok).map((r) => r.key),
    failed: results.filter((r) => !r.ok),
  });
}
