import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addComment } from '@/lib/firestore';

const addCommentSchema = z.object({
  body: z.string().trim().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = addCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await addComment(id, parsed.data.body);
  return NextResponse.json(comment, { status: 201 });
}
