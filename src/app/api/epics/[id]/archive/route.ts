import { NextResponse } from 'next/server';
import { epicsRepo } from '@/lib/repos';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await epicsRepo.archiveEpic(id);
  return NextResponse.json({ ok: true });
}
