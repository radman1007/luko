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

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** مسیرهای تعریف‌شده در روتر، بدونِ پارامتر: `/game/:gameId` → `/game` */
function definedRoutes(): { exact: Set<string>; prefixes: Set<string> } {
  const router = readFileSync(join(SRC, 'router.tsx'), 'utf8');
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  for (const [, path] of router.matchAll(/<Route\s+path="([^"]+)"/g)) {
    if (path === '*') continue;
    const dynamic = path.indexOf('/:');
    if (dynamic === -1) exact.add(path);
    else prefixes.add(path.slice(0, dynamic));
  }
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

  it('روتر مسیرهایش را دارد', () => {
    expect(exact.has('/books')).toBe(true);
    expect(prefixes.has('/game')).toBe(true);
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
