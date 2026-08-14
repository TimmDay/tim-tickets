import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEpic, getEpics } from '@/lib/firestore';
import { DEFAULT_EPIC_COLOR_THEME, EPIC_COLOR_THEME_VALUES } from '@/lib/types';

const createEpicSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(''),
  colorTheme: z.enum(EPIC_COLOR_THEME_VALUES).default(DEFAULT_EPIC_COLOR_THEME),
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

  const epic = await createEpic(parsed.data.name, parsed.data.description, parsed.data.colorTheme);
  return NextResponse.json(epic, { status: 201 });
}
