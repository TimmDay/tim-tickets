import { ScreenshotContentType } from './types';

/** Identifies an image by its leading "magic" bytes rather than trusting the upload's declared
 * Content-Type, so only real PNG/JPEG/WebP files are ever stored or served back. */
export function detectScreenshotType(bytes: Uint8Array): ScreenshotContentType | null {
  const startsWith = (signature: number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

export const SCREENSHOT_EXTENSIONS: Record<ScreenshotContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
