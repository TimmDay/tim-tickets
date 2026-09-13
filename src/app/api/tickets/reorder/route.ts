import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ticketsRepo } from '@/lib/repos';

// Either a full ordered id list (renumbered from zero), or explicit per-ticket order values
// (for permuting existing slots, e.g. sort-by-priority on a filtered subset).
const reorderSchema = z.union([
  z.object({ order: z.array(z.string().min(1)).min(1) }),
  z.object({ orders: z.array(z.object({ id: z.string().min(1), order: z.number().finite() })).min(1) }),
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if ('order' in parsed.data) {
    await ticketsRepo.reorderTickets(parsed.data.order);
  } else {
    await ticketsRepo.setTicketOrders(parsed.data.orders);
  }
  return NextResponse.json({ ok: true });
}
