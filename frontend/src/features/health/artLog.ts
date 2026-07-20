import type { Mood } from './types';

/**
 * لاگ نقاشی‌های بچه: حالِ ثبت‌شده + رنگ‌های استفاده‌شده + بندانگشتی.
 * بعداً برای نتیجه‌گیری (ارتباط حال و رنگ) تحلیل می‌شود. (TODO: sync با بک‌اند)
 */
export interface ArtEntry {
  at: number;
  /** آخرین حالِ ثبت‌شده هنگام کشیدن نقاشی */
  mood: Mood | null;
  /** تعداد خط‌هایی که با هر رنگ کشیده شده */
  colors: Record<string, number>;
  /** بندانگشتی کوچک JPEG (data URL) */
  thumbnail: string;
}

const LOG_KEY = 'luko_art_log';
const MAX_ENTRIES = 30;

export function readArtLog(): ArtEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as ArtEntry[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

/** ذخیره‌ی نقاشی جدید؛ تعداد کل نقاشی‌های ذخیره‌شده را برمی‌گرداند */
export function saveArtEntry(entry: ArtEntry): number {
  const log = [entry, ...readArtLog()].slice(0, MAX_ENTRIES);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return log.length;
}
