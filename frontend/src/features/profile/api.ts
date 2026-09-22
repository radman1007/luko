import { apiClient } from '@/lib/api';

export const profileApi = {
  /** موجودیِ گنج — سرور آن را از دستاوردها می‌دهد، اپ فقط نشان می‌دهد */
  async treasures(): Promise<number> {
    const { data } = await apiClient.get('/treasures');
    return Number(data.data.treasures) || 0;
  },
};
