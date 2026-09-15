import { describe, expect, it } from 'vitest';
import { detectScreenshotType } from '../screenshots';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('detectScreenshotType', () => {
  it('recognises PNG, JPEG and WebP by their signatures', () => {
    expect(detectScreenshotType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(detectScreenshotType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectScreenshotType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp');
  });

  it('rejects anything else, including RIFF files that are not WebP', () => {
    expect(detectScreenshotType(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF
    expect(detectScreenshotType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull(); // WAV
    expect(detectScreenshotType(bytes())).toBeNull();
  });
});
