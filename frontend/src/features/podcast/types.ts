import type { IconType } from 'react-icons';

/** دسته‌های پادکست — همان انتخاب‌های پنلِ ادمین (Podcast.Category در بک‌اند) */
export const PODCAST_CATEGORIES = ['قصه', 'علمی', 'موسیقی', 'خواب'] as const;
export type PodcastCategory = (typeof PODCAST_CATEGORIES)[number];

export interface PodcastEpisode {
  id: string;
  title: string;
  /** معمولاً یکی از PODCAST_CATEGORIES؛ ردیف‌های قدیمیِ ادمین ممکن است چیزِ دیگری باشند */
  category: string;
  /** از ادمین؛ ۰ یعنی نامعلوم — در پخش، مدتِ واقعیِ فایل ملاک است */
  durationMinutes: number;
  icon: IconType;
  /** نشانیِ کاملِ فایلِ صوتی */
  audioUrl: string;
  /** سرور می‌گوید این بچه تا آخر گوشش داده (فقط کاربرِ واردشده) */
  listened: boolean;
}

/** پاسخِ GET /podcasts (camelCase) */
export interface PodcastDto {
  id: number;
  title: string;
  category: string;
  durationMinutes: number;
  icon: string;
  audioUrl: string;
  listened: boolean;
}

export interface PodcastListDto {
  episodes: PodcastDto[];
  today: PodcastDto | null;
  categories: string[];
}
