import type { IconType } from 'react-icons';

export const PODCAST_CATEGORIES = ['قصه', 'علمی', 'موسیقی', 'خواب'] as const;
export type PodcastCategory = (typeof PODCAST_CATEGORIES)[number];

export interface PodcastEpisode {
  id: string;
  title: string;
  category: PodcastCategory;
  durationMinutes: number;
  icon: IconType;
}
