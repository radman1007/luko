import { useCallback, useState } from 'react';

const LIKES_KEY = 'luko_tv_likes';

function load(): string[] {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

/** لایک ویدیوها — فعلاً localStorage (TODO: videoService.addInteraction) */
export function useLikes() {
  const [liked, setLiked] = useState<string[]>(load);

  const toggleLike = useCallback((videoId: string) => {
    setLiked((prev) => {
      const next = prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId];
      localStorage.setItem(LIKES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { liked, toggleLike };
}
