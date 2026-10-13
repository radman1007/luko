/**
 * گفتینو — گفتگوی آنلاینِ پشتیبانی، فقط برای والدین.
 *
 * اسکریپتِ شخصِ ثالث است، پس فقط وقتی کسی در پنلِ والدین است بار می‌شود و با بیرون
 * رفتن از پنل (خروج، رفتن به صفحه‌های بچه) کامل برداشته می‌شود: صفحه‌های بچه‌ها
 * هیچ‌وقت آن را ندارند. در اپِ اندروید (file://) بار نمی‌شود؛ ویجت به دامنه‌ی سایت
 * بسته است.
 *
 * مستندات: https://www.goftino.com/docs (رویدادِ `goftino_ready` و `window.Goftino`).
 */

const WIDGET_ID = 'Twz6qn';
const SCRIPT_ID = 'goftino-widget';
/** iframeی که خودِ ویجت می‌سازد */
const FRAME_ID = 'goftino_w';
/** شناسه‌ی گفتگو که خودِ ویجت در مرورگر نگه می‌دارد (همان «o» در نشانیِ اسکریپت) */
const STORAGE_KEY = `goftino_${WIDGET_ID}`;

export interface GoftinoUser {
  name?: string;
  phone?: string;
  about?: string;
  tags?: string;
  forceUpdate?: boolean;
}

interface GoftinoApi {
  setUser(user: GoftinoUser): void;
  setWidget(options: { hasIcon?: boolean; marginBottom?: number; marginRight?: number; marginLeft?: number }): void;
  unsetUserId(): void;
  open(): void;
  close(): void;
  destroy(): void;
}

declare global {
  interface Window {
    Goftino?: GoftinoApi;
  }
}

let ready = false;
/** والدی که ویجت باید بشناسد؛ اگر هنوز بالا نیامده، با «آماده» فرستاده می‌شود */
let identity: GoftinoUser | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function sendIdentity() {
  if (identity) window.Goftino?.setUser({ ...identity, forceUpdate: true });
}

/**
 * جای حبابِ گفتینو (۸۰px، گوشه‌ی پایین‌راست) در پوسته‌ی پنل (features/parent/components/layout):
 * - گوشی: منوی پایین تا ۵۶۰px تمامِ عرض است و حباب رویش می‌افتاد؛ بالای آن می‌نشیند.
 *   از ۷۴۰px منو وسط است و گوشه‌ی پایین آزاد.
 * - لپ‌تاپ (از ۱۰۲۴px): منوی کناریِ ۲۸۴ پیکسلی سمتِ راست است و حباب دکمه‌های پایینش را
 *   می‌پوشاند؛ کنارِ منو، گوشه‌ی محتوا می‌نشیند.
 * گفتینو این را فقط در لحظه‌ی «آماده» می‌پذیرد.
 */
const NARROW = '(max-width: 739px)';
const WIDE = '(min-width: 1024px)';
const ABOVE_NAV = 104;
const BESIDE_SIDEBAR = 284 + 24;

function placement() {
  if (window.matchMedia?.(NARROW).matches) return { marginBottom: ABOVE_NAV };
  if (window.matchMedia?.(WIDE).matches) return { marginRight: BESIDE_SIDEBAR };
  return null;
}

function onReady() {
  ready = true;
  const place = placement();
  if (place) window.Goftino?.setWidget(place);
  sendIdentity();
  notify();
}

/** فقط روی سایت (http/https)، نه در اپِ اندروید */
export function goftinoSupported(): boolean {
  return typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** همان کارِ تکه‌کدِ گفتینو، یک‌بار */
export function loadGoftino(): void {
  if (!goftinoSupported() || document.getElementById(SCRIPT_ID)) return;
  window.removeEventListener('goftino_ready', onLateReady);
  window.addEventListener('goftino_ready', onReady);
  const script = document.createElement('script');
  const base = `https://www.goftino.com/widget/${WIDGET_ID}`;
  const saved = readStorage(STORAGE_KEY);
  script.id = SCRIPT_ID;
  script.type = 'text/javascript';
  script.async = true;
  script.src = saved ? `${base}?o=${encodeURIComponent(saved)}` : base;
  document.head.appendChild(script);
}

function teardown() {
  try {
    window.Goftino?.destroy();
  } catch {
    // ویجتِ نیمه‌بار؛ چیزی برای برداشتن نیست
  }
  document.getElementById(SCRIPT_ID)?.remove();
  document.getElementById(FRAME_ID)?.remove();          // اگر destroy جا گذاشت
  try {
    // اسکریپتِ گفتینو سراسری‌اش را پاک‌نشدنی تعریف می‌کند؛ delete در strict mode صفحه را می‌انداخت
    window.Goftino = undefined;
  } catch {
    // فقط‌خواندنی؛ بی‌ready دیگر به آن دست نمی‌زنیم
  }
}

/**
 * گفتینو بعضی وقت‌ها پس از برداشتن خودش دوباره بالا می‌آید: `unsetUserId` در خروج ویجت را
 * برای بازدیدکننده‌ی تازه پشتِ صحنه دوباره می‌سازد و نیم‌ثانیه بعد «آماده» می‌دهد. بیرونِ پنل
 * همان لحظه دوباره برداشته می‌شود.
 */
function onLateReady() {
  teardown();
}

/** ویجت، اسکریپت و API از صفحه برداشته می‌شوند تا بیرونِ پنلِ والدین هیچ ردی نماند */
export function removeGoftino(): void {
  window.removeEventListener('goftino_ready', onReady);
  teardown();
  window.addEventListener('goftino_ready', onLateReady);
  identity = null;
  if (ready) {
    ready = false;
    notify();
  }
}

/** پشتیبانی بداند با کدام والد حرف می‌زند */
export function identifyGoftinoUser(user: GoftinoUser): void {
  identity = user;
  if (ready) sendIdentity();
}

/**
 * خروجِ والد: گفتگوی او روی این مرورگر نمی‌ماند تا کسِ بعدی (والدِ دیگر روی همان
 * دستگاه) آن را نبیند. تاریخچه در پنلِ گفتینو برای پشتیبانی می‌ماند.
 */
export function forgetGoftinoUser(): void {
  try {
    if (ready) window.Goftino?.unsetUserId();
  } catch {
    // ویجت بار نشده بود
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ذخیره‌سازی در دسترس نیست
  }
}

export function openGoftino(): void {
  if (ready) window.Goftino?.open();
}

export function setGoftinoWidget(options: Parameters<GoftinoApi['setWidget']>[0]): void {
  if (ready) window.Goftino?.setWidget(options);
}

/**
 * شیت یا پنجره‌ای روی پنل باز است: حبابِ گفتینو (z-indexِ دو میلیارد) رویش نیفتد.
 * چند پنجره‌ی هم‌زمان شمرده می‌شوند؛ قاعده‌ی CSS در styles/globals.css است.
 */
let covers = 0;
export function coverGoftino(): () => void {
  covers += 1;
  document.documentElement.setAttribute('data-goftino-covered', '');
  let done = false;
  return () => {
    if (done) return;
    done = true;
    covers = Math.max(0, covers - 1);
    if (!covers) document.documentElement.removeAttribute('data-goftino-covered');
  };
}

export function isGoftinoReady(): boolean {
  return ready;
}

export function subscribeGoftino(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
