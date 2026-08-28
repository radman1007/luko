import { apiClient } from '@/lib/api';

/** درخواست‌های بازی‌ها. پاکتِ {data} همین‌جا باز می‌شود. */
export const gamesApi = {
  /** شناسه‌ی مرحله‌هایی که سرور تمام‌شده می‌داند */
  async completedSlugs(): Promise<string[]> {
    const { data } = await apiClient.get('/books');
    return data.data.completed ?? [];
  },
};
