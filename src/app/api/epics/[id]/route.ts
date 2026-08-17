import { NextResponse } from 'next/server';
import { z } from 'zod';
import { epicsRepo } from '@/lib/repos';
import { EPIC_COLOR_THEME_VALUES } from '@/lib/types';

const updateEpicSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  colorTheme: z.enum(EPIC_COLOR_THEME_VALUES).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateEpicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await epicsRepo.updateEpic(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await epicsRepo.deleteEpic(id);
  return NextResponse.json({ ok: true });
}
