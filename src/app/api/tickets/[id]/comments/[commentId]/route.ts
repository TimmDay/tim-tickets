import { NextResponse } from 'next/server';
import { deleteComment } from '@/lib/firestore';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  await deleteComment(id, commentId);
  return NextResponse.json({ ok: true });
}
