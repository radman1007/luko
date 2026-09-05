import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone } from '../phone';

const OK = '09374646412';

describe('normalizePhone', () => {
  it.each([
    ['09374646412', OK],
    ['۰۹۳۷۴۶۴۶۴۱۲', OK],
    ['٠٩٣٧٤٦٤٦٤١٢', OK],
    ['0937 464 6412', OK],
    ['0937-464-6412', OK],
    ['+989374646412', OK],
    ['00989374646412', OK],
    ['989374646412', OK],
    ['9374646412', OK],
    ['۹۳۷۴۶۴۶۴۱۲', OK],
    ['(0937) 4646412', OK],
  ])('%s → %s', (raw, want) => {
    expect(normalizePhone(raw)).toBe(want);
    expect(isValidPhone(raw)).toBe(true);
  });

  it.each(['', '0912', '0812345678901', '12345678901', 'سلام', '0812345678'])(
    'رد می‌کند: %s',
    (raw) => expect(isValidPhone(raw)).toBe(false),
  );

  it('بیشتر از ۱۱ رقم را می‌بُرد', () => {
    expect(normalizePhone('093746464129999')).toBe(OK);
  });
});
