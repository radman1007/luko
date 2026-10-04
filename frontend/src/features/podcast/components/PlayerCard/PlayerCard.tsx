import type { KeyboardEvent, MouseEvent } from 'react';
import { HiOutlineExclamationTriangle, HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2';
import type { PodcastEpisode } from '../../types';
import styles from './PlayerCard.module.css';

interface Props {
  episode: PodcastEpisode;
  playing: boolean;
  elapsed: number;
  /** مدتِ کل (ثانیه) — از خودِ فایل وقتی آمد، وگرنه از ادمین */
  duration: number;
  /** بین ۰ و ۱ */
  progress: number;
  /** فایل در راه است */
  buffering?: boolean;
  error?: string | null;
  onToggle: () => void;
  /** جلو/عقب بردن، بینِ ۰ و ۱ */
  onSeek?: (ratio: number) => void;
}

/** گامِ کلیدهای جهت (ثانیه) */
const SEEK_STEP = 10;

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toLocaleString('fa-IR')}:${s.toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
}

export function PlayerCard({ episode, playing, elapsed, duration, progress, buffering, error, onToggle, onSeek }: Props) {
  // نوار راست‌به‌چپ پر می‌شود، پس فاصله از لبه‌ی راست ملاک است
  const seekByPointer = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) onSeek?.((rect.right - e.clientX) / rect.width);
  };
  const seekByKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    // در راست‌به‌چپ، «جلو» یعنی کلیدِ چپ
    const step = e.key === 'ArrowLeft' ? SEEK_STEP : e.key === 'ArrowRight' ? -SEEK_STEP : 0;
    if (!step) return;
    e.preventDefault();
    onSeek?.((elapsed + step) / duration);
  };
  const status = error ? 'پخش نشد' : buffering ? 'در حالِ آماده‌شدن…' : playing ? 'در حال پخش…' : 'آماده‌ی پخش';

  return (
    <section className={styles.card} aria-label="در حال پخش">
      <div className={styles.top}>
        {/* دیسک چرخان — موقع پخش می‌چرخد */}
        <div className={`${styles.disc} ${playing ? styles.spinning : ''}`} aria-hidden>
          <span className={styles.discHole} />
          <episode.icon className={styles.discIcon} />
        </div>

        <div className={styles.info}>
          <p className={styles.nowLabel}>{status}</p>
          <h2 className={styles.title}>{episode.title}</h2>
          <p className={styles.meta}>
            {episode.category}
            {duration > 0 && <> · {Math.max(1, Math.round(duration / 60)).toLocaleString('fa-IR')} دقیقه</>}
          </p>
        </div>

        <button
          type="button"
          className={styles.playBtn}
          onClick={onToggle}
          aria-label={playing ? 'توقف' : 'پخش'}
          aria-busy={buffering || undefined}
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
          className={styles.seek}
          role="slider"
          tabIndex={0}
          aria-label="جای پخش"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.floor(duration))}
          aria-valuenow={Math.floor(elapsed)}
          aria-valuetext={`${formatTime(elapsed)} از ${formatTime(duration)}`}
          onClick={seekByPointer}
          onKeyDown={seekByKey}
        >
          <span className={styles.track}>
            <span className={styles.fill} style={{ width: `${progress * 100}%` }} />
          </span>
        </div>
        <span className={styles.time}>{formatTime(duration)}</span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          <HiOutlineExclamationTriangle aria-hidden />
          {error}
        </p>
      )}
    </section>
  );
}
