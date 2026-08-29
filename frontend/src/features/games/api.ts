import { apiClient } from '@/lib/api';

/** درخواست‌های بازی‌ها. پاکتِ {data} همین‌جا باز می‌شود. */
export const gamesApi = {
  /**
   * شناسه‌ی مرحله‌هایی که سرور تمام‌شده می‌داند.
   * نقطه‌ی سبکِ اختصاصی، نه `/books` — آن یکی کلِ کاتالوگ را سریالایز
   * می‌کرد فقط برای همین فهرست، و کندترین مسیرِ API بود.
   */
  async completedSlugs(): Promise<string[]> {
    const { data } = await apiClient.get('/games/completed');
    return data.data.completed ?? [];
  },

  /**
   * آدرسِ کوتاه‌عمرِ فایلِ بازی. فایل‌ها مستقیم قابلِ دانلود نیستند و
   * nginx فقط لینکِ امضاشده‌ی سرور را می‌پذیرد.
   */
  async playLink(slug: string): Promise<string> {
    const { data } = await apiClient.get(`/games/${slug}/play-link`);
    return data.data.url as string;
  },
};
