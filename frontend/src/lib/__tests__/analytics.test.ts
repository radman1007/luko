import { describe, expect, it } from 'vitest';
import { GA_IDS, gaIdFor } from '../analytics';

/**
 * تفکیکِ آمار بر اساسِ صفحه است نه دامنه، چون پنلِ والدین از هر دو دامنه
 * باز می‌شود و تفکیکِ دامنه‌ای آن را در آمارِ دانش‌آموز می‌انداخت.
 */
describe('کدام property برای کدام مسیر', () => {
  it.each(['/', '/games', '/game/math-1-1', '/luko-club', '/luko-health', '/garden',
    '/profile', '/login', '/register'])('%s → پنلِ دانش‌آموز', (path) => {
    expect(gaIdFor(path)).toBe(GA_IDS.kid);
  });

  it.each(['/parent-panel', '/parent-panel/reports', '/parent-login'])(
    '%s → پنلِ والدین', (path) => {
      expect(gaIdFor(path)).toBe(GA_IDS.parent);
    },
  );

  it('دو شناسه با هم قاطی نشده‌اند', () => {
    expect(GA_IDS.kid).toBe('G-JBMJDK7VB9');
    expect(GA_IDS.parent).toBe('G-TC8SD3D062');
  });
});
