/**
 * گوگل آنالیتیکس — دو propertyِ جدا: پنلِ دانش‌آموز و پنلِ والدین.
 *
 * ملاکِ تفکیک «صفحه» است نه دامنه. هر دو دامنه یک اپِ واحد را می‌دهند
 * (`panel.luko.ir` فقط ریشه‌اش به `/parent-panel` می‌رود و بقیه‌ی مسیرها
 * یکی‌اند)، پس تفکیکِ دامنه‌ای یعنی والدی که از `my.luko.ir` وارد پنل
 * می‌شود در آمارِ دانش‌آموز بیفتد. همان تقسیمی که `audienceForPath` برای
 * توکن‌ها می‌کند، این‌جا هم درست است.
 *
 * هیچ چیزی از خودِ کاربر فرستاده نمی‌شود: نه شماره، نه شناسه‌ی حساب. مسیرها
 * هم شناسه‌ی شخصی ندارند و سیگنال‌های تبلیغاتی خاموش است — این اپ را بچه‌ها
 * باز می‌کنند.
 */
import { audienceForPath } from './api';
import type { Audience } from './api';

/** شناسه‌ی GA4 هر پنل. عمومی‌اند و در خودِ صفحه هم دیده می‌شوند. */
export const GA_IDS: Record<Audience, string> = {
  kid: 'G-JBMJDK7VB9', // my.luko.ir — پنلِ دانش‌آموز
  parent: 'G-TC8SD3D062', // panel.luko.ir — پنلِ والدین
};

/** این مسیر آمارش به کدام property می‌رود؟ */
export function gaIdFor(path: string): string {
  return GA_IDS[audienceForPath(path)];
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * فقط روی صفحه‌ی واقعیِ وب.
 *
 * در توسعه خاموش است تا آمار با کلیکِ خودمان شلوغ نشود، و روی بیلدِ فایلیِ
 * اندروید هم (مبدأ `file://`) خاموش می‌ماند چون آن‌جا نشانیِ صفحه معنایی
 * برای گوگل ندارد.
 */
function enabled(): boolean {
  if (import.meta.env.DEV) return false;
  return typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
}

/** هر property فقط یک‌بار بار می‌شود، حتی اگر کاربر بینِ دو پنل برود و بیاید. */
const configured = new Set<string>();

function install(id: string) {
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // همان شکلِ رسمیِ گوگل: خودِ arguments، نه آرایه‌ای که از آن بسازیم
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
  }

  if (configured.has(id)) return;
  configured.add(id);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  // بازدیدِ صفحه را خودمان می‌فرستیم: در SPA مسیر بدونِ بارگذاریِ تازه عوض
  // می‌شود و page_viewِ خودکار فقط یک‌بار — برای همان صفحه‌ی اول — می‌رفت.
  window.gtag!('config', id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

/** بازدیدِ یک مسیر را به propertyِ همان پنل می‌فرستد. */
export function trackPageView(path: string) {
  if (!enabled()) return;
  const id = gaIdFor(path);
  install(id);
  window.gtag!('event', 'page_view', {
    send_to: id,
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
