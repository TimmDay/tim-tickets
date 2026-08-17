import { NextResponse } from 'next/server';
import { ticketsRepo } from '@/lib/repos';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  await ticketsRepo.deleteComment(id, commentId);
  return NextResponse.json({ ok: true });
}
