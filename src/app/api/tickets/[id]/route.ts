import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ticketsRepo } from '@/lib/repos';

const updateTicketSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'in_review', 'done']).optional(),
  jogId: z.string().min(1).optional(),
  epicId: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await ticketsRepo.updateTicket(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ticketsRepo.deleteTicket(id);
  return NextResponse.json({ ok: true });
}
