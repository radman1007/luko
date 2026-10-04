import { describe, expect, it } from 'vitest';
import { RELOAD_GAP_MS, RELOAD_KEY, claimReload, isChunkError } from '../chunkReload';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('isChunkError', () => {
  it('پیام‌های واقعیِ نیامدنِ چانک را می‌شناسد', () => {
    // همان خطایی که صفحه‌ی اشتراک را در پروداکشن سفید کرد
    expect(isChunkError(new Error('Unable to preload CSS for https://my.luko.ir/assets/ParentSubscription-C6gXKGFB.css'))).toBe(true);
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://my.luko.ir/assets/Garden-x1.js'))).toBe(true);
    expect(isChunkError(new TypeError('error loading dynamically imported module: https://my.luko.ir/assets/a.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('خطای معمولیِ رندر را چانک حساب نمی‌کند', () => {
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isChunkError('Unable to preload CSS')).toBe(false);
    expect(isChunkError(null)).toBe(false);
  });
});

describe('claimReload', () => {
  it('بارِ اول اجازه می‌دهد و زمان را ثبت می‌کند', () => {
    const storage = memoryStorage();
    expect(claimReload(storage, 1_000_000)).toBe(true);
    expect(storage.data.get(RELOAD_KEY)).toBe('1000000');
  });

  it('تا پایانِ فاصله دوباره اجازه نمی‌دهد — حلقه‌ی بارگذاری ساخته نمی‌شود', () => {
    const storage = memoryStorage();
    claimReload(storage, 1_000_000);
    expect(claimReload(storage, 1_000_000 + RELOAD_GAP_MS - 1)).toBe(false);
    expect(storage.data.get(RELOAD_KEY)).toBe('1000000');
    expect(claimReload(storage, 1_000_000 + RELOAD_GAP_MS)).toBe(true);
  });

  it('حافظه‌ی بسته یعنی بی‌بارگذاری', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(claimReload(broken, 5)).toBe(false);
  });
});
