/**
 * خروجیِ نقاشی برای گالری.
 *
 * بومِ بزرگ هر شکلی می‌تواند داشته باشد (ایستاده روی گوشی، پهن روی تبلت)، پس
 * اندازه با «بلندترین ضلع» محدود می‌شود نه با پهنا. سقفِ حجم همان سقفِ سرور
 * است (backend/apps/health/serializers.py)؛ اگر نقاشیِ پُررنگ از آن گذشت
 * کیفیت کمی پایین می‌آید تا ذخیره رد نشود.
 */
export const THUMB = { maxSide: 240, quality: 0.7, maxChars: 60_000 };
export const FULL = { maxSide: 720, quality: 0.82, maxChars: 900_000 };

const MIN_QUALITY = 0.4;

/** اندازه‌ی خروجی: بلندترین ضلع حداکثر maxSide، بدونِ بزرگ‌کردن */
export function fitSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** کیفیت‌هایی که به‌ترتیب امتحان می‌شوند تا خروجی زیرِ سقف بماند */
export function qualitySteps(start: number): number[] {
  const steps: number[] = [];
  for (let q = start; q >= MIN_QUALITY - 1e-9; q -= 0.14) steps.push(Math.round(q * 100) / 100);
  return steps;
}

export function exportDrawing(
  canvas: HTMLCanvasElement,
  { maxSide, quality, maxChars }: { maxSide: number; quality: number; maxChars: number },
): string {
  const size = fitSize(canvas.width, canvas.height, maxSide);
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;
  // بومِ نقاشی پس‌زمینه‌ی سفید دارد؛ JPEG شفافیت ندارد و همین درست است
  out.getContext('2d')?.drawImage(canvas, 0, 0, size.width, size.height);

  let url = '';
  for (const q of qualitySteps(quality)) {
    url = out.toDataURL('image/jpeg', q);
    if (url.length <= maxChars) break;
  }
  return url;
}
