import { apiClient } from '@/lib/api';
import type { AiTier } from './types';

/** همان شکلِ apps/ai/assistant.py */
export interface AssistantMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'done' | 'failed';
  tier: AiTier | '';
  tierLabel: string;
  atFa: string;
}

export interface AssistantTier {
  key: AiTier;
  /** «لوکو سریع» / «لوکو همراه» / «لوکو بینش» */
  label: string;
  /** یک جمله درباره‌ی این سطح */
  note: string;
  /** فقط با اشتراکِ همین فرزند */
  locked: boolean;
  used: number;
  /** سهمیه‌ی این هفته (از شنبه) */
  limit: number;
  left: number;
}

export interface ConversationRow {
  id: number;
  title: string;
  updatedFa: string;
  /** شمارِ پیام‌ها (فقط در فهرستِ تاریخچه) */
  messages?: number;
}

export interface ConversationList {
  locked: boolean;
  count: number;
  items: ConversationRow[];
}

export interface AssistantThread {
  enabled: boolean;
  /** null = گفت‌وگوی تازه (هنوز پرسشی نیست) */
  conversation: ConversationRow | null;
  /** تاریخچه فقط با اشتراک باز است؛ count برای دعوت به اشتراک */
  history: { locked: boolean; count: number };
  messages: AssistantMessage[];
  pending: boolean;
  quota: {
    premium: boolean;
    period: 'week';
    tiers: AssistantTier[];
    freeLimit: number;
    premiumLimits: Record<AiTier, number>;
  };
  /** سقفِ نویسه‌ی هر پیام */
  questionMax: number;
  suggestions: string[];
}

/** کدام گفت‌وگو: شناسه، «new» (تازه و خالی) یا null (آخرین) */
export type ConversationPick = number | 'new' | null;

export const assistantApi = {
  async thread(childId: string, conversation: ConversationPick): Promise<AssistantThread> {
    const { data } = await apiClient.get(`/parent/assistant/${childId}`,
      { params: conversation === null ? undefined : { c: conversation } });
    return data.data;
  },

  async ask(childId: string, text: string, tier: AiTier, conversation?: number):
    Promise<{ conversation: ConversationRow; messages: AssistantMessage[] }> {
    const { data } = await apiClient.post(`/parent/assistant/${childId}`, { text, tier, conversation });
    return data.data;
  },

  async conversations(childId: string): Promise<ConversationList> {
    const { data } = await apiClient.get(`/parent/assistant/${childId}/conversations`);
    return data.data;
  },

  async remove(childId: string, conversation?: number): Promise<void> {
    await apiClient.delete(`/parent/assistant/${childId}`, { params: conversation ? { c: conversation } : undefined });
  },
};
