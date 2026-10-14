import { HiBookmark, HiOutlineBookmark, HiOutlineCheckCircle, HiOutlineLockClosed } from 'react-icons/hi2';
import type { LearnSummary } from '../../learnApi';
import { LearnCover } from './LearnCover';
import { KIND_LOOK, TOPIC_LOOK } from './look';
import styles from './LearnCard.module.css';

interface Props {
  item: LearnSummary;
  onOpen: () => void;
  onSave?: (saved: boolean) => void;
  /** چرا همین محتوا برای این بچه پیشنهاد شده */
  reason?: string;
  layout?: 'grid' | 'row';
}

/**
 * کارتِ هر محتوا. کلِ کارت باز می‌کند (دکمه‌ی عنوان روی کارت کشیده شده)؛ نشانک جدا و رویِ آن است تا
 * دکمه‌ی تودرتو نسازیم.
 */
export function LearnCard({ item, onOpen, onSave, reason, layout = 'grid' }: Props) {
  const topic = TOPIC_LOOK[item.topic] ?? TOPIC_LOOK.learning;
  return (
    <article className={styles.card} data-layout={layout} data-done={item.done || undefined}>
      <div className={styles.media}><LearnCover item={item} compact={layout === 'row'} /></div>
      <div className={styles.body}>
        <span className={styles.topic} style={{ color: topic.ink }}>{item.topicLabel}</span>
        <h3>
          <button type="button" className={styles.open} onClick={onOpen}>{item.title}</button>
        </h3>
        {reason ? <p className={styles.reason}>{reason}</p> : item.summary && <p className={styles.summary}>{item.summary}</p>}
        <footer className={styles.foot}>
          {item.locked ? (
            <span className={styles.lock}><HiOutlineLockClosed aria-hidden /> با اشتراک باز می‌شود</span>
          ) : item.done ? (
            <span className={styles.done}><HiOutlineCheckCircle aria-hidden /> {KIND_LOOK[item.kind].doneAlready}</span>
          ) : (
            <span className={styles.author}>{item.author}</span>
          )}
          {onSave && (
            <button type="button" className={styles.save} aria-pressed={item.saved}
              aria-label={item.saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره برای بعد'} onClick={() => onSave(!item.saved)}>
              {item.saved ? <HiBookmark aria-hidden /> : <HiOutlineBookmark aria-hidden />}
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
