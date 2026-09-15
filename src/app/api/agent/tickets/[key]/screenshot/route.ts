import { NextResponse } from 'next/server';
import { bearerToken, isValidAgentToken } from '@/lib/auth';
import { ticketsRepo } from '@/lib/repos';

// Agent workflows download a ticket's screenshot here before running Claude. Same bearer-token
// auth as the report route (and likewise exempt from the session gate — see proxy.ts).
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!isValidAgentToken(bearerToken(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;
  const ticket = await ticketsRepo.getTicketByKey(key);
  const screenshot = ticket ? await ticketsRepo.getScreenshot(ticket.id) : null;
  if (!screenshot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new Response(new Uint8Array(screenshot.data), {
    headers: { 'Content-Type': screenshot.contentType, 'Cache-Control': 'no-store' },
  });
}
