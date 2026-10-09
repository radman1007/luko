/** «۱۲٬۳۴۵» */
export function faNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString('fa-IR') : String(value);
}

/** «۱۹۹٬۰۰۰ تومان» */
export function toman(value: number): string {
  return `${faNum(value)} تومان`;
}

/** دقیقه → «۱ ساعت و ۲۰ دقیقه» */
export function minutes(value: number): string {
  if (!value) return '۰ دقیقه';
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${faNum(m)} دقیقه`;
  // عددِ بزرگ در کاشی جا شود: از ۱۰ ساعت به بالا دقیقه‌ها مهم نیستند
  if (h >= 10) return `${faNum(Math.round(value / 60))} ساعت`;
  return m ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
}

const LATIN = '0123456789';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** ارقامِ فارسی/عربی → لاتین (برای فرستادن به سرور) */
export function latinDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const fa = PERSIAN.indexOf(d);
    return fa >= 0 ? LATIN[fa] : LATIN['٠١٢٣٤٥٦٧٨٩'.indexOf(d)];
  });
}

/** «۱۴۰۵/۷/۱۷» درست است؟ (فقط شکل؛ اعتبارِ روز را سرور می‌سنجد) */
export function looksLikeJalali(text: string): boolean {
  return /^\s*1[34]\d{2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,2}\s*$/.test(latinDigits(text));
}
