import { apiClient } from '@/lib/api';
import type { Mood } from './types';

/** یک نقاشیِ ذخیره‌شده در گالری — بدونِ تصویرِ کامل تا فهرست سبک بماند */
export interface Drawing {
  id: number;
  title: string;
  mood: Mood | '';
  colors: Record<string, number>;
  /** بندانگشتیِ data URL */
  thumbnail: string;
  /** «امروز، ۱۴:۳۰» — سرور فارسی‌اش می‌کند */
  when: string;
  createdAt: string;
}

export interface NewDrawing {
  title?: string;
  mood?: Mood | null;
  colors: Record<string, number>;
  thumbnail: string;
  image: string;
}

/** نقاشی‌ها. پاکتِ {data} همین‌جا باز می‌شود. */
export const drawingsApi = {
  async list(): Promise<Drawing[]> {
    const { data } = await apiClient.get('/paintings');
    return data.data ?? [];
  },

  async save(drawing: NewDrawing): Promise<Drawing> {
    const { data } = await apiClient.post('/paintings', {
      ...drawing,
      mood: drawing.mood ?? '',
    });
    return data.data;
  },

  /** تصویرِ کامل — فقط وقتی بچه یک نقاشی را باز می‌کند */
  async image(id: number): Promise<string> {
    const { data } = await apiClient.get(`/paintings/${id}/image`);
    return data.data.image as string;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/paintings/${id}`);
  },
};
