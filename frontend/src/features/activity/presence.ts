import { apiClient } from '@/lib/api';

/**
 * «من آنلاینم» برای آمارِ داشبورد: هر دقیقه، فقط وقتی صفحه دیده می‌شود و اینترنت هست.
 * کاربرِ واردشده با توکنِ خودش شمرده می‌شود، مهمان با یک شناسه‌ی تصادفیِ دستگاه
 * (هیچ اطلاعاتِ شخصی‌ای نمی‌رود). اپِ اندروید از file:// اجرا می‌شود؛ همین سکو را می‌گوید
 * و چون بی‌اینترنت چیزی نمی‌فرستد، فقط استفاده‌ی آنلاینِ اپ شمرده می‌شود.
 */

const DEVICE_KEY = 'luko_device_id';
const EVERY_MS = 60_000;
/** دو ضربانِ پشتِ‌سرِ‌هم (تایمر + برگشتن به تب) یکی حساب شود */
const MIN_GAP_MS = 45_000;
const DEVICE_RE = /^[A-Za-z0-9-]{8,40}$/;

export type Platform = 'web' | 'android';

export function detectPlatform(protocol: string): Platform {
  return protocol === 'file:' ? 'android' : 'web';
}

export function makeDeviceId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

export function isDeviceId(value: string | null): value is string {
  return Boolean(value && DEVICE_RE.test(value));
}

let memoryDevice = '';

function deviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (isDeviceId(stored)) return stored;
    const fresh = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : makeDeviceId();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // حافظه‌ی بسته: شناسه فقط تا بسته‌شدنِ صفحه
    memoryDevice ||= makeDeviceId();
    return memoryDevice;
  }
}

let started = false;
let lastBeat = 0;

async function beat(): Promise<void> {
  if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
  const now = Date.now();
  if (now - lastBeat < MIN_GAP_MS) return;
  lastBeat = now;
  try {
    await apiClient.post('/presence/beat', { platform: detectPlatform(window.location.protocol), device: deviceId() });
  } catch {
    /* آمار است، نه کارِ کاربر — خطا بی‌صدا */
  }
}

export function startPresence(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.setInterval(() => void beat(), EVERY_MS);
  document.addEventListener('visibilitychange', () => void beat());
  window.addEventListener('online', () => void beat());
  void beat();
}
