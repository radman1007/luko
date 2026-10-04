/**
 * چانکِ صفحه نیامد — معمولاً نسخه‌ی تازه منتشر شده و نامِ فایل‌ها عوض شده.
 * پیام‌ها از Vite (preloadِ CSS)، کروم، فایرفاکس و سافاری.
 */
const CHUNK_ERROR =
  /Unable to preload CSS|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export const RELOAD_KEY = 'luko_chunk_reload_at';
/** اگر همین تازگی یک‌بار بارگذاری کرده‌ایم، دوباره نه — وگرنه حلقه‌ی بی‌پایان */
export const RELOAD_GAP_MS = 30_000;

export function isChunkError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message);
}

/** آیا یک بارگذاریِ خودکار مجاز است؟ اگر بله، زمانش را ثبت می‌کند. */
export function claimReload(storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()): boolean {
  try {
    const last = Number(storage.getItem(RELOAD_KEY) || 0);
    if (now - last < RELOAD_GAP_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    // حافظه‌ی مرورگر بسته است: بی‌ثبت، حلقه را نمی‌شود مهار کرد
    return false;
  }
}
