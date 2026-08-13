import { NextResponse } from 'next/server';
import { archiveEpic } from '@/lib/firestore';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await archiveEpic(id);
  return NextResponse.json({ ok: true });
}
