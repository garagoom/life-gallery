import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIsMobile from './useIsMobile';

function mockMatchMedia(matches) {
  const listeners = new Set();
  const media = {
    matches,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    dispatch: (next) => {
      media.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
  window.matchMedia = vi.fn(() => media);
  return media;
}

describe('useIsMobile', () => {
  const original = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = original;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('reads the initial viewport', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => media.dispatch(true));
    expect(result.current).toBe(true);
  });
});
