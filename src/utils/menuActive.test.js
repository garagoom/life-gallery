import { describe, expect, it } from 'vitest';
import { matchMenuChild, resolveMenuPageKey } from './menuActive.js';

const photographyChildren = [
  { key: 'home', path: '/photography/home' },
  { key: 'portfolio', path: '/photography/portfolio' },
  { key: 'admin', path: '/photography/admin' },
  { key: 'calendar', path: '/photography/calendar' },
  { key: 'review', path: '/photography/admin/review' },
];

describe('matchMenuChild', () => {
  it('matches nested calendar day routes to calendar', () => {
    expect(matchMenuChild('/photography/calendar/2026-07-26', photographyChildren)?.key).toBe('calendar');
  });

  it('prefers the longest path match', () => {
    expect(matchMenuChild('/photography/admin/review', photographyChildren)?.key).toBe('review');
  });
});

describe('resolveMenuPageKey', () => {
  it('does not fall back to home for unknown nested paths', () => {
    expect(resolveMenuPageKey('/photography/photo/12', photographyChildren)).toBe('');
  });

  it('uses background path for photo overlay', () => {
    expect(
      resolveMenuPageKey('/photography/photo/12', photographyChildren, '/photography/calendar/2026-07-26'),
    ).toBe('calendar');
  });

  it('keeps exact home match', () => {
    expect(resolveMenuPageKey('/photography/home', photographyChildren)).toBe('home');
  });
});
