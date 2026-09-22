/**
 * داده‌های سرور برای بازشدنِ بی‌اینترنت می‌مانند — ولی فقط فهرستِ مجاز، و
 * داده‌ی شخصیِ یک بچه هرگز برای بچه‌ی دیگرِ همین گوشی بازنمی‌گردد.
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistQueries, persistScope, restoreQueries } from '../queryPersist';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const PATH = [{ id: 'g-1', title: 'اول', order: 1, week: 1, coinReward: 10, maxStars: 3 }];

function filled(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(['games', 'path', 1], PATH);
  client.setQueryData(['games', 'completed'], { completed: ['g-1'], stars: {} });
  client.setQueryData(['my-assignment'], null);
  client.setQueryData(['parent', 'children'], [{ id: 'c1', password: 'secret' }]);
  client.setQueryData(['games', 'play-link', 'g-1'], 'https://signed');
  return client;
}

async function saved(client: QueryClient, owner: string | null) {
  vi.useFakeTimers();
  const stop = persistQueries(client, () => owner);
  client.setQueryData(['games', 'path', 1], PATH); // یک تغییر تا ذخیره راه بیفتد
  await vi.runAllTimersAsync();
  stop();
  vi.useRealTimers();
  return JSON.parse(localStorage.getItem('luko_query_cache')!);
}

describe('ذخیره‌ی داده‌ها برای آفلاین', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('window', globalThis);
  });

  it('فقط فهرستِ مجاز: مسیر و پیشرفت آری، پنلِ والد و لینکِ امضاشده نه', () => {
    expect(persistScope(['games', 'path', 2])).toBe('shared');
    expect(persistScope(['games', 'grades'])).toBe('shared');
    expect(persistScope(['games', 'completed'])).toBe('personal');
    expect(persistScope(['games', 'memories', 'season-1'])).toBe('personal');
    expect(persistScope(['my-assignment'])).toBe('personal');
    expect(persistScope(['parent', 'children'])).toBeNull();
    expect(persistScope(['games', 'play-link', 'g-1'])).toBeNull();
    expect(persistScope(['health', 'drawings'])).toBeNull();
  });

  it('همان بچه: همه‌ی داده‌های مجاز برمی‌گردند', async () => {
    const stored = await saved(filled(), '7');
    expect(stored.state.queries.map((q: { queryKey: unknown[] }) => q.queryKey[0] + '/' + (q.queryKey[1] ?? ''))).not.toContain('parent/children');
    const next = new QueryClient();
    restoreQueries(next, '7');
    expect(next.getQueryData(['games', 'path', 1])).toEqual(PATH);
    expect(next.getQueryData(['games', 'completed'])).toEqual({ completed: ['g-1'], stars: {} });
    expect(next.getQueryData(['parent', 'children'])).toBeUndefined();
    expect(next.getQueryData(['games', 'play-link', 'g-1'])).toBeUndefined();
  });

  it('بچه‌ی دیگر یا بی‌حساب: فقط مسیرِ مشترک، نه پیشرفتِ بچه‌ی قبلی', async () => {
    await saved(filled(), '7');
    for (const owner of ['8', null]) {
      const next = new QueryClient();
      restoreQueries(next, owner);
      expect(next.getQueryData(['games', 'path', 1])).toEqual(PATH);
      expect(next.getQueryData(['games', 'completed'])).toBeUndefined();
    }
  });

  it('بی‌حساب چیزِ شخصی نمی‌نویسد', async () => {
    const stored = await saved(filled(), null);
    expect(stored.state.queries.every((q: { queryKey: unknown[] }) => persistScope(q.queryKey) === 'shared')).toBe(true);
  });

  it('نسخه‌ی کهنه یا داده‌ی خراب نادیده گرفته می‌شود', () => {
    localStorage.setItem('luko_query_cache', '{bad json');
    const a = new QueryClient();
    expect(() => restoreQueries(a, '7')).not.toThrow();
    localStorage.setItem('luko_query_cache', JSON.stringify({ version: 999, savedAt: Date.now(), owner: '7', state: { queries: [], mutations: [] } }));
    const b = new QueryClient();
    restoreQueries(b, '7');
    expect(b.getQueryCache().getAll()).toHaveLength(0);
  });
});
