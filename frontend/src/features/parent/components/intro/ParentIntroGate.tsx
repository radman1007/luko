import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { HiMiniPause, HiMiniPlay, HiOutlineForward, HiOutlineSpeakerWave, HiOutlineSpeakerXMark } from 'react-icons/hi2';
import styles from './ParentIntroGate.module.css';

const VIDEO_VERSION = 'v1';
const VIDEO_SRC = '/videos/parent-panel-intro.mp4';

interface Props {
  viewerId: string;
  children: ReactNode;
}

function watchedKey(viewerId: string): string {
  return `luko_parent_intro_${VIDEO_VERSION}:${viewerId}`;
}

/** «این نشست پرسیده شد» — تا در هر رفت‌وبرگشتِ داخلِ اپ دوباره نپرسد */
function askedKey(viewerId: string): string {
  return `luko_parent_intro_asked_${VIDEO_VERSION}:${viewerId}`;
}

function askedThisSession(viewerId: string): boolean {
  try {
    return sessionStorage.getItem(askedKey(viewerId)) === '1';
  } catch {
    return false;
  }
}

function rememberAsked(viewerId: string): void {
  try {
    sessionStorage.setItem(askedKey(viewerId), '1');
  } catch {
    // نبودن storage فقط یعنی دفعه‌ی بعد دوباره می‌پرسد؛ چیزی خراب نمی‌شود.
  }
}

/**
 * حالتِ دروازه:
 * `first` بارِ اول (خودکار باز می‌شود) · `prompt` پرسشِ ورودهای بعدی ·
 * `replay` تماشای دلخواه · `off` پنل باز است.
 */
type Mode = 'first' | 'prompt' | 'replay' | 'off';

function hasWatched(viewerId: string): boolean {
  try {
    return localStorage.getItem(watchedKey(viewerId)) === '1';
  } catch {
    // اگر storage در دسترس نبود، حالت امن این است که ویدیو دوباره نشان داده شود.
    return false;
  }
}

function initialMode(viewerId: string): Mode {
  if (!hasWatched(viewerId)) return 'first';
  return askedThisSession(viewerId) ? 'off' : 'prompt';
}

/** «۱:۰۵» با رقمِ فارسی */
function clock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return text.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/**
 * دروازه‌ی ورود به پنل والدین.
 *
 * بارِ اول ویدیوی آشنایی خودکار باز می‌شود. والد با نوارِ پخش جلو و عقب می‌رود، مکث می‌کند یا «رد کردن» می‌زند؛
 * پایانِ ویدیو یا رد کردن پنل را باز می‌کند و دیگر خودکار نمی‌آید. از ورودِ بعدی فقط **پرسیده** می‌شود که
 * می‌خواهد دوباره ببیند یا نه (همان پخش‌کننده، با دکمه‌ی بستن).
 * مهمان و کاربر واقعی هر دو از همین مسیر رد می‌شوند؛ کلیدِ viewer یعنی هر حساب روی این دستگاه فقط یک بار
 * نسخه‌ی فعلیِ ویدیو را خودکار می‌بیند.
 */
export function ParentIntroGate({ viewerId, children }: Props) {
  const [mode, setMode] = useState<Mode>(() => initialMode(viewerId));
  const first = mode === 'first';
  const watching = first || mode === 'replay';
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageKey = useMemo(() => watchedKey(viewerId), [viewerId]);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsInteraction(false);
    } catch {
      // بعضی مرورگرها حتی autoplay بی‌صدا را هم تا اولین لمس متوقف می‌کنند.
      setNeedsInteraction(true);
    }
  }, []);

  useEffect(() => {
    setMode(initialMode(viewerId));
    setNeedsInteraction(false);
    setLoadFailed(false);
    setCurrent(0);
  }, [viewerId]);

  // پشتِ پنجره اسکرول نشود؛ Escape فقط تماشای دلخواه را می‌بندد
  useEffect(() => {
    if (!watching) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mode === 'replay') setMode('off');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [watching, mode]);

  /** پایانِ ویدیو یا «رد کردن»: پنل باز می‌شود و ویدیو دیگر خودکار نمی‌آید */
  const finish = useCallback(() => {
    videoRef.current?.pause();
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // نبودن storage نباید کاربر را پشتِ ویدیو نگه دارد.
    }
    rememberAsked(viewerId);
    setMode('off');
  }, [storageKey, viewerId]);

  const close = useCallback(() => {
    videoRef.current?.pause();
    setMode('off');
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void play();
    else video.pause();
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = Math.min(Math.max(0, value), duration || video.duration || 0);
    setCurrent(video.currentTime);
  };

  const onTime = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    setCurrent(video.currentTime);
    if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
  };

  /** پاسخِ والد به پرسشِ ورودهای بعدی */
  const answerPrompt = (watch: boolean) => {
    rememberAsked(viewerId);
    if (!watch) {
      setMode('off');
      return;
    }
    setCurrent(0);
    setLoadFailed(false);
    setNeedsInteraction(false);
    setMode('replay');
  };

  const retry = () => {
    const video = videoRef.current;
    if (!video) return;
    setLoadFailed(false);
    setNeedsInteraction(false);
    video.load();
    void play();
  };

  const percent = duration ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <>
      <div className={first ? styles.panelBlocked : undefined} aria-hidden={first || undefined}>
        {children}
      </div>

      {mode === 'prompt' && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="parent-intro-ask">
          <div className={styles.askCard}>
            <span className={styles.badge}>ویدیوی آشنایی</span>
            <h1 id="parent-intro-ask" className={styles.askTitle}>
              می‌خواهید ویدیوی آشنایی با لوکو را ببینید؟
            </h1>
            <p className={styles.askText}>
              همان راهنمای کوتاهِ اولِ کار است؛ هر وقت خواستید می‌توانید دوباره ببینیدش.
            </p>
            <div className={styles.askRow}>
              <button type="button" className={styles.askYes} onClick={() => answerPrompt(true)}>
                بله، ببینم
              </button>
              <button type="button" className={styles.askNo} onClick={() => answerPrompt(false)}>
                نه، ممنون
              </button>
            </div>
          </div>
        </div>
      )}

      {watching && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="parent-intro-title">
          <div className={styles.card}>
            {mode === 'replay' && (
              <button type="button" className={styles.closeReplay} onClick={close} aria-label="بستن">
                ×
              </button>
            )}
            <div className={styles.heading}>
              <span className={styles.badge}>راهنمای کوتاه</span>
              <h1 id="parent-intro-title">
                {first ? 'پیش از شروع، این ویدیوی کوتاه را ببینید' : 'ویدیوی آشنایی با لوکو'}
              </h1>
              <p>
                {first
                  ? 'با پایانِ ویدیو پنل باز می‌شود. می‌توانید جلو و عقب بروید یا ردش کنید.'
                  : 'هر وقت خواستید می‌توانید ببندیدش.'}
              </p>
            </div>

            <div className={styles.videoWrap}>
              <video
                ref={videoRef}
                className={styles.video}
                src={VIDEO_SRC}
                autoPlay
                muted={muted}
                playsInline
                preload="auto"
                disablePictureInPicture
                controlsList="nodownload noremoteplayback"
                onContextMenu={(event) => event.preventDefault()}
                onClick={toggle}
                onLoadedMetadata={onTime}
                onLoadedData={() => {
                  setLoadFailed(false);
                  void play();
                }}
                onTimeUpdate={onTime}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={first ? finish : close}
                onError={() => setLoadFailed(true)}
              />

              {loadFailed && (
                <div className={styles.message} role="alert">
                  <b>ویدیو بارگذاری نشد</b>
                  <span>اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</span>
                  <div className={styles.messageRow}>
                    <button type="button" onClick={retry}>تلاش دوباره</button>
                    {first && <button type="button" className={styles.messageGhost} onClick={finish}>ورود به پنل</button>}
                  </div>
                </div>
              )}

              {!loadFailed && needsInteraction && (
                <div className={styles.message}>
                  <b>برای شروع ویدیو صفحه را لمس کنید</b>
                  <button type="button" onClick={() => void play()}>شروع پخش</button>
                </div>
              )}
            </div>

            {/* نوارِ پخش چپ‌به‌راست مثلِ همه‌ی پخش‌کننده‌ها؛ dir روی خودِ عنصرها هم هست تا هیچ مرورگری برعکسش نکند */}
            <div className={styles.controls} dir="ltr">
              <button type="button" className={styles.iconButton} onClick={toggle}
                aria-label={playing ? 'مکث' : 'پخش'}>
                {playing ? <HiMiniPause aria-hidden /> : <HiMiniPlay aria-hidden />}
              </button>
              <input
                type="range"
                dir="ltr"
                className={styles.seek}
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(current, duration || 0)}
                disabled={!duration}
                style={{ '--p': `${percent}%` } as CSSProperties}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="جای پخش"
                aria-valuetext={`${clock(current)} از ${clock(duration)}`}
              />
              <span className={styles.time} aria-hidden>
                {clock(current)} / {clock(duration)}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={muted ? 'روشن کردن صدا' : 'قطع صدا'}
                aria-pressed={!muted}
                onClick={() => {
                  const nextMuted = !muted;
                  setMuted(nextMuted);
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                  void play();
                }}
              >
                {muted ? <HiOutlineSpeakerXMark aria-hidden /> : <HiOutlineSpeakerWave aria-hidden />}
              </button>
            </div>

            {first && (
              <div className={styles.footerRow}>
                <span>{`${Math.round(percent).toLocaleString('fa-IR')}٪ دیده شده`}</span>
                <button type="button" className={styles.skipButton} onClick={finish}>
                  رد کردن و ورود به پنل
                  <HiOutlineForward aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
