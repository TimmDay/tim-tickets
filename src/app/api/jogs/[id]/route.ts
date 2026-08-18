import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jogsRepo } from '@/lib/repos';

const updateJogSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  order: z.number().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateJogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await jogsRepo.updateJog(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await jogsRepo.deleteJog(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete jog';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
