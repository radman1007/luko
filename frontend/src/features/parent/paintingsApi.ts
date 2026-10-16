import { apiClient } from '@/lib/api';

/** همان شکلِ apps/ai/paintings.py */
export interface PaintingAnalysis {
  status: 'pending' | 'done' | 'failed';
  /** فقط در جزئیات */
  content?: string;
  atFa?: string;
}

export interface ChildPainting {
  id: number;
  title: string;
  mood: string;
  /** «شاد» … */
  moodLabel: string;
  /** بندانگشتیِ data URL */
  thumbnail: string;
  when: string;
  colors: { color: string; label: string; count: number }[];
  analysis: PaintingAnalysis | null;
}

export interface PaintingGallery {
  premium: boolean;
  enabled: boolean;
  items: ChildPainting[];
}

export interface PaintingDetail extends ChildPainting {
  /** تصویرِ کامل (data URL) */
  image: string;
  premium: boolean;
  enabled: boolean;
}

export const paintingsApi = {
  async list(childId: string): Promise<PaintingGallery> {
    const { data } = await apiClient.get(`/parent/children/${childId}/paintings`);
    return data.data;
  },

  async detail(childId: string, id: number): Promise<PaintingDetail> {
    const { data } = await apiClient.get(`/parent/children/${childId}/paintings/${id}`);
    return data.data;
  },

  async analyze(childId: string, id: number): Promise<PaintingDetail> {
    const { data } = await apiClient.post(`/parent/children/${childId}/paintings/${id}`);
    return data.data;
  },
};
