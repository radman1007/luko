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
  modelName: string;
  atFa: string;
}

export interface AssistantTier {
  key: AiTier;
  /** «پایه» / «حرفه‌ای» / «پیشرفته» */
  label: string;
  /** «DeepSeek V4 Flash» */
  name: string;
  /** فقط با اشتراکِ همین فرزند */
  locked: boolean;
  used: number;
  limit: number;
  left: number;
}

export interface AssistantThread {
  enabled: boolean;
  messages: AssistantMessage[];
  pending: boolean;
  quota: {
    premium: boolean;
    tiers: AssistantTier[];
    freeLimit: number;
    premiumLimits: Record<AiTier, number>;
  };
  suggestions: string[];
}

export const assistantApi = {
  async thread(childId: string): Promise<AssistantThread> {
    const { data } = await apiClient.get(`/parent/assistant/${childId}`);
    return data.data;
  },

  async ask(childId: string, text: string, tier: AiTier): Promise<AssistantMessage[]> {
    const { data } = await apiClient.post(`/parent/assistant/${childId}`, { text, tier });
    return data.data.messages;
  },

  async clear(childId: string): Promise<void> {
    await apiClient.delete(`/parent/assistant/${childId}`);
  },
};
