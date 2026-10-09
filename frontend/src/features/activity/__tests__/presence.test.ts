import { describe, expect, it } from 'vitest';
import { detectPlatform, isDeviceId, makeDeviceId } from '../presence';

describe('presence', () => {
  it('اپِ اندروید از file:// اجرا می‌شود', () => {
    expect(detectPlatform('file:')).toBe('android');
    expect(detectPlatform('https:')).toBe('web');
    expect(detectPlatform('http:')).toBe('web');
  });

  it('شناسه‌ی دستگاه همان شکلی است که سرور می‌پذیرد', () => {
    const id = makeDeviceId();
    expect(isDeviceId(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(makeDeviceId()).not.toBe(id);
  });

  it('شناسه‌ی خراب پذیرفته نمی‌شود', () => {
    expect(isDeviceId(null)).toBe(false);
    expect(isDeviceId('short')).toBe(false);
    expect(isDeviceId('bad id with spaces!')).toBe(false);
  });
});
