/**
 * رفتن به درگاهِ پرداخت.
 *
 * زیبال: نشانی صفحه‌ی گذرِ خودمان روی دامنه‌ی ثبت‌شده‌ی درگاه است (panel.luko.ir) که با Refererِ همان دامنه به
 * زیبال می‌رود (apps/billing/views.ZibalGoView)؛ از my.luko.ir زیبال «دامنه غیرمجاز» می‌گفت.
 *
 * وندار فقط وقتی صفحه‌ی بانک را باز می‌کند که Referer دامنه‌ی ثبت‌شده‌ی ما باشد؛
 * سیاستِ کلیِ سایت `Referrer-Policy: same-origin` است و با `location.href` هیچ
 * Refererی به دامنه‌ی دیگر نمی‌رسید (والد صفحه‌ی خطای وندار را می‌دید). پیوندی با
 * `referrerpolicy` خودش همین یک ناوبری را با «فقط دامنه» (بی‌مسیر و پارامتر) می‌فرستد.
 */
export function goToGateway(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.referrerPolicy = 'strict-origin-when-cross-origin';
  link.rel = 'external';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
