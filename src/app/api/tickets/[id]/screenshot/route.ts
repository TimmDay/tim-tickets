import { NextResponse } from 'next/server';
import { ticketsRepo } from '@/lib/repos';
import { detectScreenshotType } from '@/lib/screenshots';
import { SCREENSHOT_MAX_BYTES } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const screenshot = await ticketsRepo.getScreenshot(id);
  if (!screenshot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new Response(new Uint8Array(screenshot.data), {
    headers: {
      'Content-Type': screenshot.contentType,
      // The modal requests `?v=<updatedAt>`, so a replaced screenshot gets a new URL — safe to
      // cache hard. `private` since it sits behind the password gate.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

/** Replaces the ticket's screenshot. Body: the raw image bytes (compressed client-side). */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0) {
    return NextResponse.json({ error: 'Empty upload' }, { status: 400 });
  }
  if (data.length > SCREENSHOT_MAX_BYTES) {
    return NextResponse.json({ error: `Screenshot too large (max ${SCREENSHOT_MAX_BYTES} bytes)` }, { status: 413 });
  }
  const contentType = detectScreenshotType(data);
  if (!contentType) {
    return NextResponse.json({ error: 'Screenshot must be a PNG, JPEG or WebP image' }, { status: 415 });
  }

  const screenshot = await ticketsRepo.setScreenshot(id, data, contentType);
  if (!screenshot) {
    return NextResponse.json({ error: 'Ticket not found, or already done' }, { status: 404 });
  }
  return NextResponse.json(screenshot);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await ticketsRepo.deleteScreenshot(id);
  return NextResponse.json({ ok: true });
}
