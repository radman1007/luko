/**
 * هر مقصدی که کد به آن navigate می‌کند باید واقعاً route داشته باشد.
 *
 * سه صفحه به `/games` می‌فرستادند در حالی که نقشه‌ی سیزن روی `/books` است؛
 * چون یک `*` هم هست، کاربر بی‌هیچ خطایی روی خانه می‌افتاد و به‌نظر می‌آمد
 * بازی‌ها کار نمی‌کنند. این تست همان را می‌گیرد.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_MAP_PATH, SEASON_MAP_PATH } from '@/lib/constants/nav';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** ثابت‌هایی که روتر به‌جای رشته‌ی خام می‌نویسد */
const NAMED: Record<string, string> = {
  SEASON_MAP_PATH,
  LEGACY_MAP_PATH,
};

/**
 * مسیرهای تعریف‌شده در روتر، بدونِ پارامتر: `/game/:gameId` → `/game`.
 * هم `path="/x"` را می‌فهمد هم `path={CONST}` را، چون روتر برای مسیرهای
 * مشترک از ثابت استفاده می‌کند تا با بقیه‌ی پروژه از هم نیفتند.
 */
function definedRoutes(): { exact: Set<string>; prefixes: Set<string> } {
  const router = readFileSync(join(SRC, 'router.tsx'), 'utf8');
  const exact = new Set<string>();
  const prefixes = new Set<string>();

  const add = (path: string) => {
    if (!path || path === '*') return;
    const dynamic = path.indexOf('/:');
    if (dynamic === -1) exact.add(path);
    else prefixes.add(path.slice(0, dynamic));
  };

  for (const [, path] of router.matchAll(/<Route\s+path="([^"]+)"/g)) add(path);
  for (const [, name] of router.matchAll(/<Route\s+path=\{(\w+)\}/g)) add(NAMED[name]);
  return { exact, prefixes };
}

/** مقصدهای ثابتِ ناوبری: navigate('/x')، <Navigate to="/x">، to="/x" */
function navigationTargets(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  const found = new Set<string>();
  for (const [, path] of code.matchAll(/navigate\(\s*'(\/[^'`${}]*)'/g)) found.add(path);
  for (const [, path] of code.matchAll(/\bto="(\/[^"${}]*)"/g)) found.add(path);
  return [...found];
}

describe('مقصدهای ناوبری', () => {
  const { exact, prefixes } = definedRoutes();

  it('نقشه‌ی سیزن روی همان مسیری است که ثابت می‌گوید', () => {
    expect(exact.has(SEASON_MAP_PATH)).toBe(true);
    expect(prefixes.has('/game')).toBe(true);
  });

  it('آدرسِ قدیمیِ نقشه هنوز route دارد', () => {
    // بوکمارک و تاریخچه‌ی بچه‌ها نباید با تغییرِ آدرس بشکند
    expect(exact.has(LEGACY_MAP_PATH)).toBe(true);
  });

  it('هیچ صفحه‌ای مسیرِ نقشه را دستی ننوشته', () => {
    /**
     * رشته‌ی خام دیر یا زود از ثابت جدا می‌افتد — همان چیزی که یک‌بار
     * باعث شد کاربر بی‌هیچ خطایی روی صفحه‌ی خانه بیفتد.
     */
    const raw: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith('nav.ts') || file.endsWith('router.tsx')) continue;
      const code = readFileSync(file, 'utf8');
      for (const [, path] of code.matchAll(/navigate\(\s*'(\/[^'`${}]*)'/g)) {
        if (path === SEASON_MAP_PATH || path === LEGACY_MAP_PATH) {
          raw.push(`${file.replace(SRC, 'src')} → ${path}`);
        }
      }
    }
    expect(raw).toEqual([]);
  });

  it('هیچ صفحه‌ای به مسیرِ تعریف‌نشده نمی‌فرستد', () => {
    const broken: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const target of navigationTargets(file)) {
        const known =
          exact.has(target) ||
          [...prefixes].some((prefix) => target === prefix || target.startsWith(`${prefix}/`));
        if (!known) broken.push(`${file.replace(SRC, 'src')} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
