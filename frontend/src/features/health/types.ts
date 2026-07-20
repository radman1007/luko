import type { MoodVariant } from '@/components/ui/icons';

export type Mood = MoodVariant;

export interface SecretEntry {
  id: string;
  title: string;
  /** خروجی رمزنگاری‌شده — متن خام هرگز ذخیره نمی‌شود */
  payload: string;
  createdAt: number;
}

export interface GardenState {
  waterCount: number;
  lastWateredAt: number | null;
}
