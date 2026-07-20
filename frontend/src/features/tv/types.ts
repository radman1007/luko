import type { IconType } from 'react-icons';

export const TV_CATEGORIES = ['کارتون', 'علمی', 'قصه', 'موسیقی'] as const;
export type TvCategory = (typeof TV_CATEGORIES)[number];

export interface TvVideo {
  id: string;
  title: string;
  category: TvCategory;
  durationMinutes: number;
  views: number;
  icon: IconType;
}
