import { describe, it, expect } from 'vitest';
import { snapFloatingMenuPos, clampY, BUTTON_SIZE, EDGE } from './floatingMenuPos';

describe('snapFloatingMenuPos', () => {
  it('snaps to the left edge when center is on the left half', () => {
    const pos = snapFloatingMenuPos(100, 200, 1000, 800);
    expect(pos.side).toBe('left');
    expect(pos.x).toBe(EDGE);
    expect(pos.y).toBe(200);
  });

  it('snaps to the right edge when center is on the right half', () => {
    const pos = snapFloatingMenuPos(800, 120, 1000, 800);
    expect(pos.side).toBe('right');
    expect(pos.x).toBe(1000 - BUTTON_SIZE - EDGE);
    expect(pos.y).toBe(120);
  });

  it('clamps y inside the viewport', () => {
    expect(clampY(-40, 800)).toBe(EDGE);
    expect(clampY(9000, 800)).toBe(800 - BUTTON_SIZE - EDGE);
  });
});
