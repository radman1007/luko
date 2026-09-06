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

  /** مرحله‌های تمام‌شده به‌همراهِ بهترین ستاره‌ی هرکدام */
  async progress(): Promise<{ completed: string[]; stars: Record<string, number> }> {
    const { data } = await apiClient.get('/games/completed');
    return { completed: data.data.completed ?? [], stars: data.data.stars ?? {} };
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

export interface SeasonMemory {
  id: number;
  seasonId: string;
  spotId: string;
  thumbnail: string;
  createdAt: string;
}

export interface NewMemory {
  seasonId: string;
  spotId: string;
  image: string;
  thumbnail: string;
}

/** یادگاری‌های نقشه‌ی سیزن. تصویرِ کامل مسیرِ جدا دارد تا فهرست سبک بماند. */
export const memoriesApi = {
  async list(seasonId: string): Promise<SeasonMemory[]> {
    const { data } = await apiClient.get('/games/memories', { params: { seasonId } });
    return data.data.memories ?? [];
  },

  async save(memory: NewMemory): Promise<SeasonMemory> {
    const { data } = await apiClient.post('/games/memories', memory);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/games/memories/${id}`);
  },
};
