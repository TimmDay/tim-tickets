import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AGENT_COMMENT_PREFIX, AGENT_DISPATCH_EVENT_TYPE, formatCommentsForAgent, selectAgentRunCandidates } from '@/lib/agentRuns';
import { toGithubRepoUrl } from '@/lib/github';
import { sendRepositoryDispatch } from '@/lib/githubDispatch';
import { epicsRepo, ticketsRepo } from '@/lib/repos';
import { AGENT_MODELS } from '@/lib/types';

const agentRunSchema = z.object({
  jogId: z.string().min(1),
  /** Also re-dispatch tickets that already have a run in flight. */
  includeDispatched: z.boolean().default(false),
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
  const candidates = parsed.data.includeDispatched
    ? [...selection.eligible, ...selection.alreadyDispatched]
    : selection.eligible;

  // The agent's workflow posts its result back here, so it must be reachable from GitHub —
  // i.e. the deployed app, not localhost.
  const reportBaseUrl = new URL(request.url).origin;

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
