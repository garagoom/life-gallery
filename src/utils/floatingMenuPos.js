export const BUTTON_SIZE = 56;
export const EDGE = 8;
export const STORAGE_KEY = 'life-gallery:floating-menu-pos-v3';

export function clampY(y, viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800, buttonSize = BUTTON_SIZE) {
  const maxY = Math.max(EDGE, viewportHeight - buttonSize - EDGE);
  return Math.min(maxY, Math.max(EDGE, y));
}

export function snapFloatingMenuPos(
  x,
  y,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
  buttonSize = BUTTON_SIZE,
) {
  const centerX = x + buttonSize / 2;
  const side = centerX < viewportWidth / 2 ? 'left' : 'right';
  return {
    side,
    x: side === 'left' ? EDGE : Math.max(EDGE, viewportWidth - buttonSize - EDGE),
    y: clampY(y, viewportHeight, buttonSize),
  };
}

export function readStoredPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.y !== 'number') return null;
    if (parsed.side === 'left' || parsed.side === 'right') {
      return snapFloatingMenuPos(parsed.side === 'left' ? 0 : 99999, parsed.y);
    }
    if (typeof parsed?.x === 'number') {
      return snapFloatingMenuPos(parsed.x, parsed.y);
    }
  } catch { /* ignore */ }
  return null;
}

export function defaultPos() {
  return snapFloatingMenuPos(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
    typeof window !== 'undefined' ? window.innerHeight - BUTTON_SIZE - 96 : 640,
  );
}
