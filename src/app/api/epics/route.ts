import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEpic, getEpics } from '@/lib/firestore';

const createEpicSchema = z.object({
  name: z.string().trim().min(1),
});

export async function GET() {
  const epics = await getEpics();
  return NextResponse.json(epics);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createEpicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const epic = await createEpic(parsed.data.name);
  return NextResponse.json(epic, { status: 201 });
}
