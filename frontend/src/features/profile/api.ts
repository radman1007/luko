import { apiClient } from '@/lib/api';

/** شمارنده‌هایی که سرور برای حساب نگه می‌دارد (`GET /users/me/profile`) */
export interface ProfileStats {
  coins: number;
  /** «امتیاز»: با هر مرحله‌ی تازه‌ی مسیر بالا می‌رود */
  points: number;
  treasures: number;
  gamesCompleted: number;
}

export const profileApi = {
  async stats(): Promise<ProfileStats> {
    const { data } = await apiClient.get('/users/me/profile');
    const raw = data.data as Partial<Record<keyof ProfileStats, unknown>>;
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return { coins: n(raw.coins), points: n(raw.points), treasures: n(raw.treasures), gamesCompleted: n(raw.gamesCompleted) };
  },

  /** موجودیِ گنج — سرور آن را از دستاوردها می‌دهد، اپ فقط نشان می‌دهد */
  async treasures(): Promise<number> {
    const { data } = await apiClient.get('/treasures');
    return Number(data.data.treasures) || 0;
  },
};
