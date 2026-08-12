import { NextResponse } from 'next/server';
import { completeJog } from '@/lib/firestore';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await completeJog(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete jog';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
