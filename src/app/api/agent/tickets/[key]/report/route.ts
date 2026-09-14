import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidAgentToken } from '@/lib/auth';
import { ticketsRepo } from '@/lib/repos';

// Called by an agent's GitHub workflow, not the browser — so it's exempt from the session
// cookie gate (see proxy.ts) and authenticates with `Authorization: Bearer $AGENT_API_TOKEN`
// instead. Deliberately narrow: all a leaked token can do is comment on / move a ticket.
const reportSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('pr_opened'), prUrl: z.string().url() }),
  // Sent by the separate "agent PR merged" workflow when you merge an agent's PR.
  z.object({ outcome: z.literal('merged'), prUrl: z.string().url() }),
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

  const found = await ticketsRepo.applyAgentReport(key, parsed.data);
  if (!found) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
