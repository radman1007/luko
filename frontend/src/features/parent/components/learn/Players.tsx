import { useEffect, useRef, useState } from 'react';
import { HiMiniPause, HiMiniPlay } from 'react-icons/hi2';
import styles from './Players.module.css';

interface PlayerProps {
  src: string;
  /** جای قبلیِ پخش (ثانیه) */
  start?: number;
  /** هر چند ثانیه و هنگامِ توقف: جای فعلی */
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}

const SPEEDS = [1, 1.25, 1.5, 2];
const clock = (s: number) => {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  return `${m.toLocaleString('fa-IR')}:${(total % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
};

/** پخش‌کننده‌ی پادکست: پخش و توقف، ۱۵ ثانیه جلو و عقب، سرعت و نوارِ زمان */
export function AudioPlayer({ src, start = 0, onProgress, onEnded }: PlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const reported = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = ref.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  };
  const jump = (delta: number) => {
    const audio = ref.current;
    if (audio) audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration || 0);
  };
  const report = (seconds: number, force = false) => {
    if (force || Math.abs(seconds - reported.current) >= 15) {
      reported.current = seconds;
      onProgress?.(Math.floor(seconds));
    }
  };

  return (
    <div className={styles.audio}>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          if (start > 5 && start < (e.currentTarget.duration || 0) - 5) e.currentTarget.currentTime = start;
        }}
        onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); report(e.currentTarget.currentTime); }}
        onPlay={() => setPlaying(true)}
        onPause={(e) => { setPlaying(false); report(e.currentTarget.currentTime, true); }}
        onEnded={() => { setPlaying(false); onEnded?.(); }}
        onError={() => setFailed(true)} />
      {/* چپ‌به‌راست مثلِ همه‌ی پخش‌کننده‌ها (به خواستِ کاربر): نوارِ زمان از چپ پیش می‌رود، «عقب» چپ و «جلو» راست */}
      <div className={styles.controls} dir="ltr">
        <button type="button" className={styles.skip} onClick={() => jump(-15)} aria-label="۱۵ ثانیه عقب">۱۵−</button>
        <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? 'توقف' : 'پخش'}>
          {playing ? <HiMiniPause aria-hidden /> : <HiMiniPlay aria-hidden />}
        </button>
        <button type="button" className={styles.skip} onClick={() => jump(15)} aria-label="۱۵ ثانیه جلو">۱۵+</button>
      </div>
      <input type="range" dir="ltr" className={styles.seek} min={0} max={duration || 0} step={1} value={Math.min(time, duration || 0)}
        aria-label="جای پخش" onChange={(e) => { if (ref.current) ref.current.currentTime = Number(e.target.value); }} />
      <div className={styles.meta} dir="ltr">
        <span>{clock(time)}</span>
        <button type="button" className={styles.speed} aria-label="سرعتِ پخش"
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
          {speed.toLocaleString('fa-IR')}×
        </button>
        <span>{duration ? clock(duration) : '—'}</span>
      </div>
      {failed && <p className={styles.error} role="alert">پخش نشد؛ اتصالِ اینترنت را بررسی کنید و دوباره امتحان کنید.</p>}
    </div>
  );
}

/** ویدیو: فایلِ خودِ سرور با پخش‌کننده‌ی مرورگر، یا آپاراتِ جاسازی‌شده */
export function VideoPlayer({ src, embed, poster, title, start = 0, onProgress, onEnded }: PlayerProps & {
  embed?: boolean;
  poster?: string;
  title: string;
}) {
  const reported = useRef(0);
  if (embed) {
    return (
      <div className={styles.video}>
        <iframe src={src} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  }
  return (
    // کنترل‌های خودِ مرورگر در صفحه‌ی راست‌به‌چپ برعکس می‌شوند (نوارِ زمان از راست)؛ dir=ltr درستش می‌کند
    <div className={styles.video} dir="ltr">
      <video src={src} poster={poster || undefined} controls playsInline preload="metadata"
        onLoadedMetadata={(e) => {
          if (start > 5 && start < (e.currentTarget.duration || 0) - 5) e.currentTarget.currentTime = start;
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          if (Math.abs(t - reported.current) >= 15) { reported.current = t; onProgress?.(Math.floor(t)); }
        }}
        onPause={(e) => onProgress?.(Math.floor(e.currentTarget.currentTime))}
        onEnded={() => onEnded?.()}>
        مرورگرِ شما پخشِ این ویدیو را پشتیبانی نمی‌کند.
      </video>
    </div>
  );
}
