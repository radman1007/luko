import { useCallback, useEffect, useState } from 'react';
import type { PodcastEpisode } from './types';

const LISTENED_KEY = 'luko_podcast_listened';

function loadListened(): string[] {
  try {
    const raw = localStorage.getItem(LISTENED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

/**
 * پخش‌کننده‌ی شبیه‌سازی‌شده: پیشرفت ثانیه‌به‌ثانیه جلو می‌رود و
 * با تمام شدن قسمت، «گوش‌داده‌شده» ثبت می‌شود.
 * TODO: با آماده شدن بک‌اند، فایل صوتی واقعی از podcastService پخش می‌شود.
 */
export function usePlayer(episodes: PodcastEpisode[]) {
  const [currentId, setCurrentId] = useState(episodes[0]?.id ?? '');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [listened, setListened] = useState<string[]>(loadListened);

  const current = episodes.find((e) => e.id === currentId) ?? episodes[0];
  const totalSeconds = (current?.durationMinutes ?? 0) * 60;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= totalSeconds) {
          setPlaying(false);
          setListened((ids) => {
            if (ids.includes(currentId)) return ids;
            const nextIds = [...ids, currentId];
            localStorage.setItem(LISTENED_KEY, JSON.stringify(nextIds));
            return nextIds;
          });
          return totalSeconds;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, currentId, totalSeconds]);

  const toggle = useCallback(() => {
    setElapsed((prev) => (prev >= totalSeconds ? 0 : prev));
    setPlaying((p) => !p);
  }, [totalSeconds]);

  const select = useCallback(
    (id: string) => {
      if (id === currentId) {
        setPlaying((p) => !p);
        return;
      }
      setCurrentId(id);
      setElapsed(0);
      setPlaying(true);
    },
    [currentId],
  );

  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;

  return { current, playing, elapsed, progress, listened, toggle, select };
}
