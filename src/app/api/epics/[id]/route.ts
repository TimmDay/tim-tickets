import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteEpic, updateEpic } from '@/lib/firestore';

const updateEpicSchema = z.object({
  name: z.string().trim().min(1),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateEpicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await updateEpic(id, parsed.data.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteEpic(id);
  return NextResponse.json({ ok: true });
}
