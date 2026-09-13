import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidAgentToken } from '@/lib/auth';
import { ticketsRepo } from '@/lib/repos';

// Called by an agent's GitHub workflow, not the browser — so it's exempt from the session
// cookie gate (see proxy.ts) and authenticates with `Authorization: Bearer $AGENT_API_TOKEN`
// instead. Deliberately narrow: all a leaked token can do is comment on / move a ticket.
const reportSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('pr_opened'), prUrl: z.string().url() }),
  z.object({ outcome: z.literal('no_changes'), runUrl: z.string().url().optional() }),
  z.object({ outcome: z.literal('failed'), runUrl: z.string().url().optional() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (!isValidAgentToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ticket = await ticketsRepo.getTicketByKey(key);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const report = parsed.data;
  if (report.outcome === 'pr_opened') {
    await ticketsRepo.updateTicket(ticket.id, { status: 'in_review', agentDispatchedAt: null });
    await ticketsRepo.addComment(ticket.id, `🤖 Agent opened a PR: ${report.prUrl}`);
  } else {
    // Clearing the stamp lets the next "Release the bots" pick the ticket up again.
    await ticketsRepo.updateTicket(ticket.id, { agentDispatchedAt: null });
    const what = report.outcome === 'no_changes' ? 'finished without making any changes' : 'run failed';
    await ticketsRepo.addComment(ticket.id, `🤖 Agent ${what}${report.runUrl ? `: ${report.runUrl}` : ''}`);
  }

  return NextResponse.json({ ok: true });
}
