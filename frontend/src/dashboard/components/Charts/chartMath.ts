/** مقیاسِ «گرد»ِ محورِ عمودی: ۰ تا عددی تمیز با حداکثر ۴ گام؛ گام هرگز کمتر از ۱ (شمارِ آدم‌ها نیم ندارد) */
export function niceScale(max: number, steps = 4): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { top: steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i) };
  const rough = max / steps;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  const step = Math.max(nice * power, 1);
  const clean = Math.ceil(max / step) * step;
  const count = Math.round(clean / step);
  return { top: clean, ticks: Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100) / 100) };
}

/** کدام برچسب‌های محورِ افقی نشان داده شوند تا روی هم نیفتند */
export function labelEvery(count: number, room: number): number {
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(room))));
}

/** جایِ افقیِ نقطه‌ی i؛ راست‌به‌چپ: قدیمی‌ترین سمتِ راست */
export function xAt(i: number, count: number, left: number, right: number): number {
  if (count <= 1) return (left + right) / 2;
  return right - (i * (right - left)) / (count - 1);
}
