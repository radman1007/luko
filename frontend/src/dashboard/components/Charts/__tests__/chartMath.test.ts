import { describe, expect, it } from 'vitest';
import { labelEvery, niceScale, xAt } from '../chartMath';

describe('niceScale', () => {
  it('سقفِ گرد و گام‌های تمیز', () => {
    expect(niceScale(87)).toEqual({ top: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(1234).top).toBe(1500);
    expect(niceScale(3)).toEqual({ top: 3, ticks: [0, 1, 2, 3] });
    expect(niceScale(1)).toEqual({ top: 1, ticks: [0, 1] });           // نه ۰٫۵ نفر
    expect(niceScale(0).ticks).toEqual([0, 1, 2, 3, 4]);
  });

  it('هیچ داده‌ای بالاتر از سقف نمی‌ماند', () => {
    for (const max of [1, 7, 13, 99, 101, 999, 4321, 0.4]) {
      expect(niceScale(max).top).toBeGreaterThanOrEqual(max);
    }
  });
});

describe('chart layout', () => {
  it('زمان از راست به چپ', () => {
    expect(xAt(0, 3, 0, 100)).toBe(100);
    expect(xAt(2, 3, 0, 100)).toBe(0);
    expect(xAt(0, 1, 0, 100)).toBe(50);
  });

  it('برچسب‌ها روی هم نمی‌افتند', () => {
    expect(labelEvery(30, 6)).toBe(5);
    expect(labelEvery(7, 10)).toBe(1);
  });
});
