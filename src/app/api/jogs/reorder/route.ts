import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reorderJogs } from '@/lib/firestore';

const reorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await reorderJogs(parsed.data.order);
  return NextResponse.json({ ok: true });
}
