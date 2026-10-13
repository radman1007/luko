import type { ComponentType, SVGProps } from 'react';
import { HiOutlineCloud, HiOutlineMoon, HiOutlineSparkles, HiOutlineSun } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import type { MoodPart } from '../../types';
import { CardHead } from './CardHead';
import { MOOD_LOOK, fa } from './moods';
import card from './card.module.css';
import styles from './DayParts.module.css';

interface Props {
  parts: MoodPart[];
  childName: string;
}

const PART_ICON: Record<MoodPart['key'], ComponentType<SVGProps<SVGSVGElement>>> = {
  morning: HiOutlineSun,
  noon: HiOutlineSun,
  afternoon: HiOutlineCloud,
  evening: HiOutlineMoon,
  late: HiOutlineSparkles,
};

/** حال در صبح، ظهر، عصر، شب و آخرِ شب — بهترین و سخت‌ترین بخش نشانه دارد */
export function DayParts({ parts, childName }: Props) {
  const best = parts.find((part) => part.tag === 'best');
  const worst = parts.find((part) => part.tag === 'worst');
  const any = parts.some((part) => part.count > 0);

  return (
    <section className={card.card} aria-labelledby="parts-title">
      <CardHead id="parts-title" icon={HiOutlineSun} tone="sun" title="حال در بخش‌های روز"
        note="چهار هفته‌ی اخیر؛ درصد یعنی چند بار شاد یا آرام بوده" />

      {!any ? (
        <p className={card.empty}>هنوز حالی ثبت نشده تا بخش‌های روز مقایسه شوند.</p>
      ) : (
        <ul className={styles.parts}>
          {parts.map((part) => {
            const Icon = PART_ICON[part.key];
            const look = part.dominant ? MOOD_LOOK[part.dominant] : null;
            return (
              <li key={part.key} className={styles.part} data-tag={part.tag} data-thin={!part.enough || undefined}>
                <span className={styles.when}>
                  <Icon aria-hidden />
                  <span><b>{part.label}</b><small>{part.range}</small></span>
                </span>
                {part.count > 0 && look && part.dominant ? (
                  <>
                    <span className={styles.face} style={{ color: look.color, background: look.soft }}>
                      <MoodFaceIcon variant={part.dominant} size={18} aria-hidden />
                      {look.label}
                    </span>
                    <span className={styles.meter} role="img" aria-label={`${fa(part.good)} درصد خوب`}>
                      <i style={{ width: `${Math.max(part.good, 3)}%` }} />
                    </span>
                    <span className={styles.value}>
                      <b>{fa(part.good)}٪</b>
                      <small>{part.enough ? `${fa(part.count)} بار` : 'کم‌داده'}</small>
                    </span>
                  </>
                ) : (
                  <span className={styles.none}>ثبتی نیست</span>
                )}
                {part.tag && <em className={styles.tag}>{part.tag === 'best' ? 'بهترین' : 'سخت‌ترین'}</em>}
              </li>
            );
          })}
        </ul>
      )}

      {best && worst && (
        <p className={card.insight}>
          {childName} <b>{best.label}‌ها</b> حالِ بهتری دارد و <b>{worst.label}‌ها</b> بیشتر
          «{worst.dominant ? MOOD_LOOK[worst.dominant].label : 'کم‌حوصله'}» است.
        </p>
      )}
    </section>
  );
}
