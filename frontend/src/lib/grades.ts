/** پایه‌های تحصیلی — برای فرم‌های ثبت‌نام، پنلِ والد و سرِ تالارِ بازی‌ها. */

/** نامِ فارسیِ هر پایه */
export const GRADE_NAMES: Record<number, string> = {
  1: 'کلاس اول',
  2: 'کلاس دوم',
  3: 'کلاس سوم',
  4: 'کلاس چهارم',
  5: 'کلاس پنجم',
  6: 'کلاس ششم',
};

/**
 * پایه‌هایی که همین حالا می‌شود انتخاب کرد.
 *
 * بقیه در فرمِ ثبت‌نام با برچسبِ «به‌زودی» غیرفعالند: بچه‌ای که پایه‌ی
 * بی‌محتوا را بزند، به یک مسیرِ خالی می‌رسد.
 */
export const OPEN_GRADES = [1, 2, 3];
export const ALL_GRADES = [1, 2, 3, 4, 5, 6];

export function gradeName(grade: number): string {
  return GRADE_NAMES[grade] ?? `کلاس ${grade.toLocaleString('fa-IR')}`;
}
