import { SCREENSHOT_MAX_BYTES } from './types';

// Long edge cap: keeps UI text in a phone or laptop screenshot legible while cutting a typical
// multi-MB PNG down to a few hundred KB.
const MAX_LONG_EDGE = 2000;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Browser-side: downsizes and re-encodes an image file for upload as a ticket screenshot.
 * Prefers WebP, falling back to JPEG where the browser can't encode WebP (it silently returns
 * PNG instead), then steps quality and size down until it fits SCREENSHOT_MAX_BYTES.
 */
export async function compressScreenshot(file: Blob): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Couldn’t read that image.');
  }

  try {
    let scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Couldn’t process that image.');
      // JPEG has no transparency — paint white first so transparent PNG areas don't turn black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const quality = attempt < 3 ? 0.85 - attempt * 0.1 : 0.65;
      let blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= SCREENSHOT_MAX_BYTES) return blob;

      // Still too big: shrink dimensions for the later attempts.
      if (attempt >= 2) scale *= 0.75;
    }
    throw new Error('That image is too large, even after compressing.');
  } finally {
    bitmap.close();
  }
}
