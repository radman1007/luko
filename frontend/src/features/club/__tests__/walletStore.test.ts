/**
 * کیفِ سکه‌ی اصلی و بازی‌ها.
 *
 * بازی‌ها (luko-wallet.js داخلِ iframe) سکه را مستقیم در localStorage
 * می‌نویسند و خبرش کمی بعد به اپ می‌رسد. جایزه‌ی پایانِ مرحله یا خریدی که در
 * همان فاصله ثبت شود باید از عددِ ذخیره‌شده شروع کند، نه از عددِ کهنه‌ی حافظه.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

async function freshStore(coins: number) {
  vi.resetModules();
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem('luko_coins', String(coins));
  return import('../store');
}

describe('کیفِ مشترکِ سکه', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('جایزه روی عددی می‌نشیند که بازی همین حالا نوشته', async () => {
    const store = await freshStore(500);
    localStorage.setItem('luko_coins', '490'); // خریدِ داخلِ بازی، خبرش هنوز نرسیده
    store.grantCoins(10);
    expect(store.getSnapshot().coins).toBe(500);
    expect(localStorage.getItem('luko_coins')).toBe('500');
  });

  it('خریدِ باشگاه موجودیِ همین لحظه را می‌سنجد', async () => {
    const store = await freshStore(500);
    localStorage.setItem('luko_coins', '3'); // بچه سکه‌ها را در بازی خرج کرده
    const cheapest = Math.min(...(await import('../clubData')).SHOP_ITEMS.map((i) => i.cost));
    const item = (await import('../clubData')).SHOP_ITEMS.find((i) => i.cost === cheapest)!;
    expect(cheapest).toBeGreaterThan(3);
    expect(store.buy(item.id, item.cost)).toEqual({ ok: false, reason: 'poor' });
    expect(localStorage.getItem('luko_coins')).toBe('3');
  });

  it('عددِ مطلقِ بازی یا سرور جایگزین می‌شود و جایزه‌ی نامعتبر نادیده گرفته می‌شود', async () => {
    const store = await freshStore(120);
    store.syncCoins(345);
    expect(store.getSnapshot().coins).toBe(345);
    store.grantCoins(0);
    store.grantCoins(-5);
    store.grantCoins(Number.NaN);
    expect(localStorage.getItem('luko_coins')).toBe('345');
  });
});
