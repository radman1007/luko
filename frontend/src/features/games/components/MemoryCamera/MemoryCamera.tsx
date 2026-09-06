import { useCallback, useEffect, useRef, useState } from 'react';
import { HiOutlineArrowPath, HiOutlineCamera, HiOutlineTrash, HiOutlineXMark } from 'react-icons/hi2';
import type { PhotoSpot } from '../../seasonData';
import styles from './MemoryCamera.module.css';

interface Props {
  spot: PhotoSpot;
  /** بندانگشتیِ عکسی که قبلاً اینجا ثبت شده */
  existing?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (photo: { image: string; thumbnail: string }) => void;
  onDelete?: () => void;
}

/** عرضِ عکسِ کامل و بندانگشتی. بیشتر از این برای یک یادگاری لازم نیست. */
const FULL_W = 900;
const THUMB_W = 220;

type Phase = 'live' | 'preview' | 'saved' | 'denied';

/** فریمِ ویدیو → data URL با عرضِ دلخواه، نسبت حفظ می‌شود */
function frameToDataUrl(video: HTMLVideoElement, width: number, quality: number): string {
  const ratio = video.videoHeight / video.videoWidth || 0.75;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // دوربینِ جلو آینه‌ای دیده می‌شود؛ عکس باید همان چیزی باشد که بچه می‌بیند
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** فایلِ انتخاب‌شده → دو اندازه، بدونِ رفتن به سرور */
async function fileToPhotos(file: File): Promise<{ image: string; thumbnail: string }> {
  const bitmap = await createImageBitmap(file);
  const draw = (width: number, quality: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round((bitmap.height / bitmap.width) * width);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };
  return { image: draw(FULL_W, 0.82), thumbnail: draw(THUMB_W, 0.7) };
}

/**
 * گرفتنِ عکسِ یادگاری.
 *
 * جریان عمداً کوتاه است — باز شو، بگیر، ببین، ذخیره کن. هیچ فرم و
 * تنظیماتی وسطش نیست چون کاربرش بچه‌ی کلاس اول است.
 *
 * اگر دوربین در دسترس نباشد (اجازه ندادند، مرورگرِ قدیمی، یا HTTP بدونِ
 * TLS که getUserMedia را قفل می‌کند) به انتخابِ فایل برمی‌گردیم؛ روی
 * موبایل همان `capture` دوربینِ سیستم را باز می‌کند.
 */
export function MemoryCamera({ spot, existing, saving, onClose, onSave, onDelete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>(existing ? 'saved' : 'live');
  const [shot, setShot] = useState<{ image: string; thumbnail: string } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('live');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      // «اجازه ندادم» و «دوربین ندارم» برای بچه فرقی ندارند — هر دو یعنی
      // از راهِ دیگری عکس بگذار.
      setPhase('denied');
    }
  }, []);

  useEffect(() => {
    if (!existing) void start();
    return stop;
  }, [existing, start, stop]);

  // بستن با Esc — همان انتظارِ همیشگیِ یک مودال
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setShot({
      image: frameToDataUrl(video, FULL_W, 0.82),
      thumbnail: frameToDataUrl(video, THUMB_W, 0.7),
    });
    setPhase('preview');
    stop();
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setShot(await fileToPhotos(file));
    setPhase('preview');
  };

  const retake = () => {
    setShot(null);
    void start();
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={`یادگاریِ ${spot.title}`}>
      <div className={styles.sheet}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="بستن">
          <HiOutlineXMark />
        </button>

        <h2 className={styles.title}>{spot.title}</h2>
        <p className={styles.prompt}>{spot.prompt}</p>

        <div className={styles.stage}>
          {phase === 'live' && (
            <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
          )}

          {phase === 'preview' && shot && (
            <img className={styles.shot} src={shot.thumbnail} alt="عکسی که گرفتی" />
          )}

          {phase === 'saved' && existing && (
            <img className={styles.shot} src={existing} alt={`یادگاریِ ${spot.title}`} />
          )}

          {phase === 'denied' && (
            <div className={styles.denied}>
              <HiOutlineCamera aria-hidden />
              <p>دوربین باز نشد. می‌تونی یه عکس از گوشیت انتخاب کنی.</p>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {phase === 'live' && (
            <button type="button" className={styles.shutter} onClick={capture} aria-label="گرفتنِ عکس">
              <span className={styles.shutterRing} aria-hidden />
            </button>
          )}

          {phase === 'preview' && shot && (
            <>
              <button type="button" className={styles.ghost} onClick={retake}>
                <HiOutlineArrowPath aria-hidden />
                دوباره
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => onSave(shot)}
                disabled={saving}
              >
                {saving ? 'در حالِ ذخیره…' : 'همینو نگه دار!'}
              </button>
            </>
          )}

          {phase === 'saved' && (
            <>
              {onDelete && (
                <button type="button" className={styles.danger} onClick={onDelete}>
                  <HiOutlineTrash aria-hidden />
                  پاک کن
                </button>
              )}
              <button type="button" className={styles.primary} onClick={retake}>
                <HiOutlineCamera aria-hidden />
                عکسِ تازه
              </button>
            </>
          )}

          {(phase === 'denied' || phase === 'live') && (
            <label className={styles.ghost}>
              از گوشی انتخاب کن
              <input
                type="file"
                accept="image/*"
                capture="user"
                className={styles.file}
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
