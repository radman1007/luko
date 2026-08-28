import { useState } from 'react';
import { HiOutlinePaintBrush, HiOutlinePhoto } from 'react-icons/hi2';
import { Link } from 'react-router-dom';
import { LUKORIANS } from '@/lib/characters';
import { useDrawings } from '@/features/health/useDrawings';
import type { Drawing } from '@/features/health/api';
import { DrawingViewer } from './DrawingViewer';
import styles from './GalleryCard.module.css';

/**
 * گنجینه‌ی نقاشی‌ها در اتاقِ بچه.
 * قابِ هر نقاشی روی دیوارِ کارگاهِ مکانو آویزان است؛ زدنِ هر قاب نسخه‌ی
 * کامل را باز می‌کند و از همان‌جا می‌شود پاکش کرد.
 */
export function GalleryCard() {
  const painter = LUKORIANS.art;
  const { drawings, loading, guest } = useDrawings();
  const [open, setOpen] = useState<Drawing | null>(null);

  return (
    <section className={styles.card} aria-label="گنجینه‌ی نقاشی‌ها">
      <header className={styles.head}>
        <span className={styles.icon} aria-hidden>
          <HiOutlinePaintBrush />
        </span>
        <div className={styles.titles}>
          <h2 className={styles.title}>گنجینه‌ی نقاشی‌ها</h2>
          <p className={styles.subtitle}>
            {drawings.length > 0
              ? `${drawings.length.toLocaleString('fa-IR')} نقاشی نگه داشتی`
              : 'هرچی بکشی و نگه داری، همین‌جا می‌مونه'}
          </p>
        </div>
        {drawings.length > 0 && (
          <span className={styles.count}>{drawings.length.toLocaleString('fa-IR')}</span>
        )}
      </header>

      {loading ? (
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : drawings.length === 0 ? (
        <div className={styles.empty}>
          <img className={styles.emptyChar} src={painter.image} alt={painter.name} />
          <p className={styles.emptyTitle}>
            {guest ? 'برای نگه‌داشتنِ نقاشی‌هات وارد شو' : 'هنوز نقاشی‌ای اینجا نیست'}
          </p>
          <p className={styles.emptyText}>
            {painter.name} منتظرِ اولین شاهکارته! برو بوم رو بردار.
          </p>
          <Link className={styles.emptyBtn} to="/luko-health">
            <HiOutlinePhoto aria-hidden />
            برو نقاشی بکش
          </Link>
        </div>
      ) : (
        <ul className={styles.grid}>
          {drawings.map((drawing) => (
            <li key={drawing.id}>
              <button
                type="button"
                className={styles.frame}
                onClick={() => setOpen(drawing)}
                aria-label={`دیدنِ نقاشیِ ${drawing.when}`}
              >
                <img className={styles.thumb} src={drawing.thumbnail} alt="" loading="lazy" />
                <span className={styles.when}>{drawing.when}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <DrawingViewer drawing={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
