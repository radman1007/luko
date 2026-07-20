import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlay } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import styles from './LatestVideoCard.module.css';

// TODO: آدرس ویدیوی معرفی لوکو تلویزیون — بعداً اضافه می‌شود (فعلاً خالی)
const INTRO_VIDEO_SRC = '';

/** معرفی لوکو تلویزیون با یک ویدیوی استاتیک که از همین‌جا پخش می‌شود */
export function LatestVideoCard() {
  const navigate = useNavigate();
  const host = LUKORIANS.tv;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setStarted(true);
  };

  return (
    <section className={styles.card} aria-label="لوکو تلویزیون">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>لوکو تلویزیون</h2>
        <span className={styles.newBadge}>داغ</span>
      </div>
      <p className={styles.desc}>کارتون، قصه و کلی ویدیوی باحال؛ {host.name} منتظرته!</p>

      {/* قاب تلویزیونِ مشکی با پخش‌کننده‌ی ویدیو */}
      <div className={styles.tv}>
        <span className={styles.antennas} aria-hidden>
          <span className={styles.antenna} />
          <span className={styles.antenna} />
        </span>

        <div className={styles.screen}>
          {INTRO_VIDEO_SRC ? (
            <>
              <video
                ref={videoRef}
                className={styles.video}
                src={INTRO_VIDEO_SRC}
                controls={started}
                playsInline
                preload="metadata"
              />
              {!started && (
                <button
                  type="button"
                  className={styles.playOverlay}
                  onClick={handlePlay}
                  aria-label="پخش ویدیو"
                >
                  <HiOutlinePlay />
                </button>
              )}
            </>
          ) : (
            // تا وقتی ویدیو اضافه نشده، صفحه‌ی خالیِ تلویزیون با نویزِ برفکی
            <div className={styles.placeholder}>
              <span className={styles.noise} aria-hidden />
              <span className={styles.playBadge} aria-hidden>
                <HiOutlinePlay />
              </span>
              <span className={styles.placeholderText}>ویدیوی معرفی به‌زودی…</span>
            </div>
          )}
        </div>

        <span className={styles.stand} aria-hidden />
      </div>

      <button type="button" className={styles.cta} onClick={() => navigate('/luko-tv')}>
        بریم تلویزیون
      </button>
    </section>
  );
}
