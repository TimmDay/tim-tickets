import { NextResponse } from 'next/server';
import { jogsRepo } from '@/lib/repos';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await jogsRepo.completeJog(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete jog';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
