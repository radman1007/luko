import { apiClient } from '@/lib/api';
import type { PodcastListDto } from './types';

export const podcastApi = {
  /** عمومی است: مهمان هم فهرست را می‌گیرد، فقط «گوش‌داده‌شده» برایش خالی است */
  list: async (): Promise<PodcastListDto> => {
    const { data } = await apiClient.get('/podcasts');
    return data.data;
  },

  /** قسمت تا آخر شنیده شد — برای تیکِ سبز روی همه‌ی دستگاه‌ها و گزارشِ والدین */
  listen: async (id: string, seconds: number): Promise<void> => {
    await apiClient.post(`/podcasts/${id}/listen`, { seconds });
  },
};
