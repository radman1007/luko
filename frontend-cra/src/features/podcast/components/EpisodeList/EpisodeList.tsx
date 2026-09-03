import { useState } from 'react';
import { HiOutlineCheckCircle, HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2';
import { PODCAST_CATEGORIES } from '../../types';
import type { PodcastCategory, PodcastEpisode } from '../../types';
import styles from './EpisodeList.module.css';

interface Props {
  episodes: PodcastEpisode[];
  currentId: string;
  playing: boolean;
  listenedIds: string[];
  onSelect: (episodeId: string) => void;
}

export function EpisodeList({ episodes, currentId, playing, listenedIds, onSelect }: Props) {
  const [category, setCategory] = useState<PodcastCategory | 'همه'>('همه');

  const filtered =
    category === 'همه' ? episodes : episodes.filter((e) => e.category === category);

  return (
    <section aria-label="قسمت‌های پادکست">
      <div className={styles.chips}>
        {(['همه', ...PODCAST_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${c === category ? styles.chipActive : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className={styles.list}>
        {filtered.map((episode) => {
          const isCurrent = episode.id === currentId;
          const isListened = listenedIds.includes(episode.id);
          return (
            <li key={episode.id}>
              <button
                type="button"
                className={`${styles.row} ${isCurrent ? styles.current : ''}`}
                onClick={() => onSelect(episode.id)}
              >
                <span className={styles.iconWrap} aria-hidden>
                  <episode.icon />
                </span>
                <span className={styles.texts}>
                  <span className={styles.title}>{episode.title}</span>
                  <span className={styles.meta}>
                    {episode.category} · {episode.durationMinutes.toLocaleString('fa-IR')} دقیقه
                  </span>
                </span>
                {isListened && (
                  <HiOutlineCheckCircle className={styles.listened} aria-label="گوش داده شد" />
                )}
                <span className={styles.playState} aria-hidden>
                  {isCurrent && playing ? <HiOutlinePause /> : <HiOutlinePlay />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
