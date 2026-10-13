import { useState } from 'react';
import type { CSSProperties } from 'react';
import { HiOutlineCalendarDays } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import type { JourneyDay } from '../../types';
import { CardHead } from './CardHead';
import { MOOD_LOOK, fa } from './moods';
import card from './card.module.css';
import styles from './MoodJourney.module.css';

interface Props {
  days: JourneyDay[];
  childName: string;
}

const PREVIEW = 6;

/** سفرِ حالِ هر روز: هر بار که حالش را گفت، ساعتش، و اگر درست پیش از آن بازی کرده بود کدام درس */
export function MoodJourney({ days, childName }: Props) {
  // پیش‌فرض: آخرین روزی که حالی دارد
  const lastFilled = [...days].reverse().find((day) => day.count > 0) ?? days[days.length - 1];
  const [picked, setPicked] = useState<string | undefined>();
  const [all, setAll] = useState(false);
  const day = days.find((item) => item.date === picked) ?? lastFilled;
  if (!day) return null;
  const entries = all ? day.entries : day.entries.slice(0, PREVIEW);

  return (
    <section className={card.card} aria-labelledby="journey-title">
      <CardHead id="journey-title" icon={HiOutlineCalendarDays} title="سفرِ حالِ روز"
        note={`هر بار که ${childName} حالش را گفت — هفت روزِ اخیر`} />

      {/* تازه‌ترین روز اول (سمتِ راست) تا روی گوشی بی‌کشیدن دیده شود */}
      <div className={styles.days} role="tablist" aria-label="انتخابِ روز">
        {[...days].reverse().map((item) => {
          const on = item.date === day.date;
          return (
            <button key={item.date} type="button" role="tab" aria-selected={on} className={styles.day}
              data-active={on || undefined} disabled={item.count === 0 && !on}
              onClick={() => { setPicked(item.date); setAll(false); }}>
              <span className={styles.dayName}>{item.label}</span>
              <b>{item.short}</b>
              <i style={{ background: item.dominant ? MOOD_LOOK[item.dominant].color : undefined }}
                aria-label={item.dominant ? MOOD_LOOK[item.dominant].label : 'بی‌ثبت'} />
            </button>
          );
        })}
      </div>

      {day.entries.length === 0 ? (
        <p className={card.empty}>{day.label} حالی ثبت نشده است.</p>
      ) : (
        <>
          <p className={styles.summary}>
            {day.label}، {fa(day.count)} بار حالش را گفت
            {day.dominant && <>؛ بیشتر <b style={{ color: MOOD_LOOK[day.dominant].color }}>«{MOOD_LOOK[day.dominant].label}»</b></>}
          </p>
          <ol className={styles.timeline}>
            {entries.map((entry, i) => (
              <li key={`${entry.time}-${i}`}
                style={{ '--mood': MOOD_LOOK[entry.mood].color, '--mood-soft': MOOD_LOOK[entry.mood].soft } as CSSProperties}>
                <time>{entry.time}</time>
                <span className={styles.dot} aria-hidden><MoodFaceIcon variant={entry.mood} size={18} /></span>
                <span className={styles.mood}>{MOOD_LOOK[entry.mood].label}</span>
                {entry.after && <span className={styles.after}>بعد از {entry.after}</span>}
              </li>
            ))}
          </ol>
          {day.entries.length > PREVIEW && (
            <button type="button" className={styles.more} onClick={() => setAll((v) => !v)}>
              {all ? 'کمتر' : `همه‌ی ${fa(day.entries.length)} بار`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
