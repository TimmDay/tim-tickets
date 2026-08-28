import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jogsRepo } from '@/lib/repos';

const setCurrentSchema = z.object({ current: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = setCurrentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await jogsRepo.setCurrentJog(id, parsed.data.current);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update current jog';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
