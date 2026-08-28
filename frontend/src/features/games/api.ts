import { apiClient } from '@/lib/api';

/** درخواست‌های بازی‌ها. پاکتِ {data} همین‌جا باز می‌شود. */
export const gamesApi = {
  /** شناسه‌ی مرحله‌هایی که سرور تمام‌شده می‌داند */
  async completedSlugs(): Promise<string[]> {
    const { data } = await apiClient.get('/books');
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
