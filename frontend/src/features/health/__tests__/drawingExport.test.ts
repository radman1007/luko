import { describe, expect, it } from 'vitest';
import { FULL, fitSize, qualitySteps, THUMB } from '../drawingExport';

describe('اندازه‌ی خروجیِ نقاشی', () => {
  it('بومِ پهنِ کارت مثلِ قبل ۲۴۰ پیکسل پهنا می‌گیرد', () => {
    expect(fitSize(680, 480, THUMB.maxSide)).toEqual({ width: 240, height: 169 });
  });

  it('بومِ ایستاده‌ی گوشی با بلندترین ضلعش محدود می‌شود، نه با پهنا', () => {
    const size = fitSize(740, 1120, FULL.maxSide);
    expect(size.height).toBe(720);
    expect(size.width).toBe(476);
  });

  it('نقاشیِ کوچک‌تر از سقف بزرگ نمی‌شود', () => {
    expect(fitSize(200, 150, FULL.maxSide)).toEqual({ width: 200, height: 150 });
  });

  it('کیفیت از مقدارِ خواسته‌شده کم می‌شود ولی از ۰٫۴ پایین‌تر نمی‌رود', () => {
    const steps = qualitySteps(FULL.quality);
    expect(steps[0]).toBe(0.82);
    expect(steps.at(-1)).toBeGreaterThanOrEqual(0.4);
    expect([...steps].sort((a, b) => b - a)).toEqual(steps);
  });

  it('سقفِ حجم همان سقفِ سرور است', () => {
    expect(THUMB.maxChars).toBe(60_000);
    expect(FULL.maxChars).toBe(900_000);
  });
});
