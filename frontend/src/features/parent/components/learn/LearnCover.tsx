import type { CSSProperties } from 'react';
import { HiMiniPlay } from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import type { LearnSummary } from '../../learnApi';
import { KIND_LOOK, TOPIC_LOOK, fa } from './look';
import styles from './LearnCover.module.css';

interface Props {
  item: LearnSummary;
  size?: 'card' | 'hero' | 'banner';
  /** کارتِ کوچکِ افقی: بی‌برچسبِ نوع و مدت (کنارش نوشته می‌شود) */
  compact?: boolean;
}

/** روی جلدِ هر محتوا: عکسِ شاخص یا طرحِ رنگیِ موضوع، نوع و مدت، «ویژه» و «تازه» */
export function LearnCover({ item, size = 'card', compact = false }: Props) {
  const topic = TOPIC_LOOK[item.topic] ?? TOPIC_LOOK.learning;
  const kind = KIND_LOOK[item.kind];
  const TopicIcon = topic.icon;
  const KindIcon = kind.icon;
  const style = { '--from': topic.from, '--to': topic.to, '--ink': topic.ink } as CSSProperties;
  return (
    <div className={styles.cover} data-size={size} style={style}>
      {item.cover ? (
        <img src={item.cover} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className={styles.art} aria-hidden>
          <i /><i />
          <TopicIcon />
        </span>
      )}
      {/* بالای صفحه‌ی خودِ محتوا پخش‌کننده جداست؛ دکمه‌ی پخش روی جلد آنجا گمراه می‌کند */}
      {item.kind !== 'article' && size !== 'banner' && (
        <span className={styles.play} aria-hidden><HiMiniPlay /></span>
      )}
      <span className={styles.top}>
        {item.premium && (
          <span className={styles.premium} data-locked={item.locked || undefined}>
            <CrownIcon size={12} strokeWidth={2.2} aria-hidden /> ویژه
          </span>
        )}
        {item.isNew && !compact && <span className={styles.new}>تازه</span>}
      </span>
      {!compact && <span className={styles.kind}>
        <KindIcon aria-hidden />
        {kind.label}
        {/* جداکننده‌ی خطی: نقطه‌ی «·» کنارِ رقمِ فارسی «۰» خوانده می‌شود (۲ دقیقه ← ۲۰ دقیقه) */}
        {item.minutes > 0 && <><i className={styles.sep} aria-hidden />{fa(item.minutes)} دقیقه</>}
      </span>}
    </div>
  );
}
