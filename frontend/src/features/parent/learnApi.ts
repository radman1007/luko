import { apiClient } from '@/lib/api';

/** همان شکلِ apps/learn/services.py */
export type LearnKind = 'article' | 'video' | 'podcast';
export type LearnTopic = 'learning' | 'habits' | 'emotions' | 'screen' | 'health' | 'family';

export interface LearnSummary {
  id: number;
  kind: LearnKind;
  kindLabel: string;
  title: string;
  summary: string;
  topic: LearnTopic;
  topicLabel: string;
  /** نشانیِ تصویرِ شاخص یا خالی (آن‌وقت طرحِ رنگیِ موضوع) */
  cover: string;
  /** مقاله: زمانِ خواندن؛ ویدیو و پادکست: مدت */
  minutes: number;
  author: string;
  premium: boolean;
  /** ویژه و والد اشتراک ندارد */
  locked: boolean;
  featured: boolean;
  isNew: boolean;
  publishedFa: string;
  saved: boolean;
  done: boolean;
}

export interface LearnList {
  premium: boolean;
  featured: LearnSummary | null;
  items: LearnSummary[];
  counts: Record<LearnKind, number>;
  topics: { key: LearnTopic; label: string; count: number }[];
  /** چند محتوای ویژه برای این والد قفل است */
  locked: number;
  forChild: { childName: string; picks: { item: LearnSummary; reason: string }[] } | null;
}

export interface LearnDetail extends LearnSummary {
  /** HTMLِ امنِ ساخته‌شده در سرور؛ برای محتوای قفل فقط چند بندِ اول */
  bodyHtml: string;
  media: { type: 'video' | 'audio' | 'embed'; src: string } | null;
  seconds: number;
  related: LearnSummary[];
}

export interface LearnProgressBody {
  saved?: boolean;
  done?: boolean;
  seconds?: number;
}

export const learnApi = {
  async list(childId?: string): Promise<LearnList> {
    const { data } = await apiClient.get('/parent/learn', { params: childId ? { child: childId } : undefined });
    return data.data;
  },
  async item(id: number): Promise<LearnDetail> {
    const { data } = await apiClient.get(`/parent/learn/${id}`);
    return data.data;
  },
  async progress(id: number, body: LearnProgressBody): Promise<{ saved: boolean; done: boolean; seconds: number }> {
    const { data } = await apiClient.post(`/parent/learn/${id}/progress`, body);
    return data.data;
  },
};
