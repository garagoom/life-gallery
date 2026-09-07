import { describe, it, expect } from 'vitest';
import { isImageFile } from './isImageFile';

describe('isImageFile', () => {
  it('accepts jpeg aliases used by phones', () => {
    expect(isImageFile({ type: 'image/jpg', name: 'a.jpg' })).toBe(true);
    expect(isImageFile({ type: 'image/jpeg', name: 'a.jpeg' })).toBe(true);
    expect(isImageFile({ type: 'image/pjpeg', name: 'a.jpg' })).toBe(true);
  });

  it('accepts heic from iPhone even with empty mime', () => {
    expect(isImageFile({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isImageFile({ type: '', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isImageFile({ type: 'application/octet-stream', name: 'IMG_1.heif' })).toBe(true);
  });

  it('rejects non-images', () => {
    expect(isImageFile({ type: 'video/mp4', name: 'a.mp4' })).toBe(false);
    expect(isImageFile({ type: '', name: 'notes.txt' })).toBe(false);
  });
});
