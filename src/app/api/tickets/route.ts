import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ticketsRepo } from '@/lib/repos';

const createTicketSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().default(''),
  jogId: z.string().min(1),
  epicId: z.string().nullable().default(null),
  priority: z.enum(['low', 'medium', 'high']).nullable().default(null),
  dueDate: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export async function GET() {
  const tickets = await ticketsRepo.getTickets();
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ticket = await ticketsRepo.createTicket(parsed.data);
  return NextResponse.json(ticket, { status: 201 });
}
