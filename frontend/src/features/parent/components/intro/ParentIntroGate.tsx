import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useCoverGoftino } from '@/features/support/useCoverGoftino';
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
 * `locked` بارِ اول و اجباری · `prompt` پرسشِ ورودهای بعدی ·
 * `replay` تماشای دلخواه · `off` پنل باز است.
 */
type Mode = 'locked' | 'prompt' | 'replay' | 'off';

function hasWatched(viewerId: string): boolean {
  try {
    return localStorage.getItem(watchedKey(viewerId)) === '1';
  } catch {
    // اگر storage در دسترس نبود، حالت امن این است که ویدیو دوباره پخش شود.
    return false;
  }
}

function initialMode(viewerId: string): Mode {
  if (!hasWatched(viewerId)) return 'locked';
  return askedThisSession(viewerId) ? 'off' : 'prompt';
}

/**
 * دروازه‌ی ورود به پنل والدین.
 *
 * بارِ اول اجباری است: هیچ دکمه‌ی بستن یا ردکردنی ندارد و فقط رویداد طبیعی
 * `ended` قفل را باز می‌کند. از ورودِ بعدی فقط **پرسیده** می‌شود که آیا
 * می‌خواهد ویدیوی آشنایی را ببیند؛ آن نسخه آزاد است — کنترل دارد، قابلِ
 * بستن است و هر لحظه می‌شود رهایش کرد.
 * مهمان و کاربر واقعی هر دو از همین مسیر رد می‌شوند؛ کلید viewer باعث می‌شود هر
 * حساب روی این دستگاه فقط یک بار نسخه‌ی فعلی ویدیو را کامل ببیند.
 */
export function ParentIntroGate({ viewerId, children }: Props) {
  const [mode, setMode] = useState<Mode>(() => initialMode(viewerId));
  const required = mode === 'locked';
  useCoverGoftino(mode !== 'off');
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const furthestTimeRef = useRef(0);
  const completedRef = useRef(false);
  const storageKey = useMemo(() => watchedKey(viewerId), [viewerId]);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video || completedRef.current) return;
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
    setProgress(0);
    furthestTimeRef.current = 0;
    completedRef.current = false;
  }, [viewerId]);

  useEffect(() => {
    if (!required) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const keepLocked = (event: KeyboardEvent) => {
      if (['Escape', ' ', 'ArrowLeft', 'ArrowRight', 'MediaPlayPause'].includes(event.key)) {
        event.preventDefault();
      }
    };
    const resumeWhenVisible = () => {
      if (document.visibilityState === 'visible') void play();
    };

    window.addEventListener('keydown', keepLocked, { capture: true });
    document.addEventListener('visibilitychange', resumeWhenVisible);
    void play();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', keepLocked, { capture: true });
      document.removeEventListener('visibilitychange', resumeWhenVisible);
    };
  }, [play, required]);

  const onTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    furthestTimeRef.current = Math.max(furthestTimeRef.current, video.currentTime);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
    }
  };

  const preventSeeking = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.currentTime > furthestTimeRef.current + 0.35) {
      video.currentTime = furthestTimeRef.current;
    }
  };

  const preventPause = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (!event.currentTarget.ended && !completedRef.current) void play();
  };

  const preventSpeedChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (event.currentTarget.playbackRate !== 1) event.currentTarget.playbackRate = 1;
  };

  const finish = () => {
    completedRef.current = true;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // نبودن storage نباید کاربر را بعد از تماشای کامل داخل مودال نگه دارد.
    }
    setProgress(100);
    setMode('off');
  };

  /** پاسخِ والد به پرسشِ ورودهای بعدی */
  const answerPrompt = (watch: boolean) => {
    rememberAsked(viewerId);
    if (!watch) {
      setMode('off');
      return;
    }
    setProgress(0);
    furthestTimeRef.current = 0;
    completedRef.current = false;
    setLoadFailed(false);
    setNeedsInteraction(false);
    setMode('replay');
  };

  const closeReplay = () => {
    videoRef.current?.pause();
    setMode('off');
  };

  const retry = () => {
    const video = videoRef.current;
    if (!video) return;
    setLoadFailed(false);
    setNeedsInteraction(false);
    furthestTimeRef.current = 0;
    video.load();
    void play();
  };

  return (
    <>
      <div className={required ? styles.panelBlocked : undefined} aria-hidden={required || undefined}>
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

      {(required || mode === 'replay') && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="parent-intro-title">
          <div className={styles.card}>
            {mode === 'replay' && (
              <button type="button" className={styles.closeReplay} onClick={closeReplay} aria-label="بستن">
                ×
              </button>
            )}
            <div className={styles.heading}>
              <span className={styles.badge}>راهنمای کوتاه</span>
              <h1 id="parent-intro-title">
                {required ? 'قبل از ورود به پنل، این ویدیو را کامل ببینید' : 'ویدیوی آشنایی با لوکو'}
              </h1>
              <p>
                {required
                  ? 'پس از پایان ویدیو، پنل والدین به‌صورت خودکار باز می‌شود.'
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
                // تماشای دلخواه قفل ندارد: کنترل دارد و هر لحظه می‌شود رهایش کرد
                controls={mode === 'replay'}
                disablePictureInPicture={required}
                controlsList={required ? 'nodownload noplaybackrate noremoteplayback nofullscreen' : 'nodownload'}
                onContextMenu={(event) => event.preventDefault()}
                onLoadedData={() => {
                  setLoadFailed(false);
                  void play();
                }}
                onTimeUpdate={onTimeUpdate}
                onSeeking={required ? preventSeeking : undefined}
                onPause={required ? preventPause : undefined}
                onRateChange={required ? preventSpeedChange : undefined}
                onEnded={required ? finish : closeReplay}
                onError={() => setLoadFailed(true)}
              />

              {loadFailed && (
                <div className={styles.message} role="alert">
                  <b>ویدیو بارگذاری نشد</b>
                  <span>اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</span>
                  <button type="button" onClick={retry}>تلاش دوباره</button>
                </div>
              )}

              {!loadFailed && needsInteraction && (
                <div className={styles.message}>
                  <b>برای شروع ویدیو صفحه را لمس کنید</b>
                  <button type="button" onClick={() => void play()}>شروع پخش</button>
                </div>
              )}
            </div>

            <div className={styles.footer}>
              {/* نوارِ پیشرفت مالِ حالتِ اجباری است؛ در تماشای دلخواه خودِ
                  کنترل‌های ویدیو کارش را می‌کنند. */}
              {required && (
                <div className={styles.progressTrack} aria-label={`پیشرفت پخش ${Math.round(progress)} درصد`}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className={styles.footerRow}>
                <span>{required ? `${Math.round(progress).toLocaleString('fa-IR')}٪ دیده شده` : ''}</span>
                <button
                  type="button"
                  className={styles.soundButton}
                  onClick={() => {
                    const nextMuted = !muted;
                    setMuted(nextMuted);
                    if (videoRef.current) videoRef.current.muted = nextMuted;
                    void play();
                  }}
                >
                  {muted ? 'روشن کردن صدا' : 'قطع صدا'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
