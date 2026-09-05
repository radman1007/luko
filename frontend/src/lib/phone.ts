/**
 * شماره‌ی موبایل — همان قواعدِ `apps/accounts/utils.normalize_phone` در بک‌اند.
 * یک‌جا نگه‌شان می‌داریم تا فرم‌ها با هم اختلاف نداشته باشند.
 */

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** ارقامِ فارسی/عربی → انگلیسی و حذفِ هر چیزِ غیررقم (به‌جز + سرِ شماره). */
export function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

/**
 * شماره را به شکلِ ۰۹xxxxxxxxx درمی‌آورد.
 * چسباندنِ +98 / 0098 / 98 / 9 هم درست خوانده می‌شود — کاربر از دفترچه‌ی
 * تلفن یا پیامک کپی می‌کند و شماره اغلب با پیش‌شماره‌ی کشور می‌آید.
 */
export function normalizePhone(raw: string): string {
  let s = toEnglishDigits(String(raw ?? '')).replace(/[\s\-()]/g, '');
  s = s.replace(/^\+?0098/, '0').replace(/^\+?98(?=\d{10}$)/, '0');
  s = s.replace(/\D/g, '');
  if (/^9\d{9}$/.test(s)) s = `0${s}`;
  return s.slice(0, 11);
}

/** شماره‌ی معتبرِ موبایلِ ایران. */
export function isValidPhone(raw: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(raw));
}
