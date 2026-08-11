import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createJog, getJogs } from '@/lib/firestore';

const createJogSchema = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export async function GET() {
  const jogs = await getJogs();
  return NextResponse.json(jogs);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createJogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const jog = await createJog(parsed.data.name, parsed.data.startDate ?? null, parsed.data.endDate ?? null);
  return NextResponse.json(jog, { status: 201 });
}
