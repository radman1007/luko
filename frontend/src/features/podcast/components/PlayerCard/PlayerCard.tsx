import { HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2';
import type { PodcastEpisode } from '../../types';
import styles from './PlayerCard.module.css';

interface Props {
  episode: PodcastEpisode;
  playing: boolean;
  elapsed: number;
  /** بین ۰ و ۱ */
  progress: number;
  onToggle: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toLocaleString('fa-IR')}:${s.toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
}

export function PlayerCard({ episode, playing, elapsed, progress, onToggle }: Props) {
  return (
    <section className={styles.card} aria-label="در حال پخش">
      <div className={styles.top}>
        {/* دیسک چرخان — موقع پخش می‌چرخد */}
        <div className={`${styles.disc} ${playing ? styles.spinning : ''}`} aria-hidden>
          <span className={styles.discHole} />
          <episode.icon className={styles.discIcon} />
        </div>

        <div className={styles.info}>
          <p className={styles.nowLabel}>{playing ? 'در حال پخش…' : 'آماده‌ی پخش'}</p>
          <h2 className={styles.title}>{episode.title}</h2>
          <p className={styles.meta}>
            {episode.category} · {episode.durationMinutes.toLocaleString('fa-IR')} دقیقه
          </p>
        </div>

        <button
          type="button"
          className={styles.playBtn}
          onClick={onToggle}
          aria-label={playing ? 'توقف' : 'پخش'}
        >
          {playing ? <HiOutlinePause /> : <HiOutlinePlay />}
        </button>
      </div>

      {/* اکولایزر — فقط موقع پخش می‌رقصد */}
      <div className={`${styles.equalizer} ${playing ? '' : styles.frozen}`} aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={styles.bar} style={{ animationDelay: `${(i % 6) * 0.14}s` }} />
        ))}
      </div>

      <div className={styles.progressRow}>
        <span className={styles.time}>{formatTime(elapsed)}</span>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className={styles.fill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={styles.time}>{formatTime(episode.durationMinutes * 60)}</span>
      </div>
    </section>
  );
}
