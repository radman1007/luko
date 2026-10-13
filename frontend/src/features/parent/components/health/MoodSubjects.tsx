import { HiOutlineAcademicCap } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import type { HealthDaily } from '../../types';
import { CardHead } from './CardHead';
import { MOOD_LOOK, fa } from './moods';
import card from './card.module.css';
import styles from './MoodSubjects.module.css';

interface Props {
  daily: HealthDaily;
  childName: string;
}

/** «+۳۳» در متنِ راست‌به‌چپ «۳۳+» دیده می‌شد؛ با کلمه روشن‌تر است */
const versus = (lift: number) =>
  lift === 0 ? 'هم‌اندازه‌ی میانگین'
    : `${fa(Math.abs(lift))}٪ ${lift > 0 ? 'بالاتر' : 'پایین‌تر'} از میانگین`;

/**
 * حال و درس‌ها: حالش بعد از بازیِ هر درس، کنارِ میانگینِ خودش (خطِ نازک)، و این‌که با حالِ
 * خوب چقدر بهتر یاد می‌گیرد. «با کدام درس حالش بهتر می‌شود» همین‌جاست.
 */
export function MoodSubjects({ daily, childName }: Props) {
  const { subjects, baseline, learning } = daily;
  const up = subjects.find((row) => row.lift >= 15);

  return (
    <section className={card.card} aria-labelledby="subjects-mood-title">
      <CardHead id="subjects-mood-title" icon={HiOutlineAcademicCap} title="حال و درس‌ها"
        note={`حالِ ${childName} در یک ساعت بعد از بازیِ هر درس`} />

      {subjects.length === 0 ? (
        <p className={card.empty}>
          هنوز بعد از بازی‌ها حالِ کافی ثبت نشده است. هر بار که بعد از بازی حالش را بگوید، این‌جا کامل‌تر می‌شود.
        </p>
      ) : (
        <>
          <ul className={styles.rows}>
            {subjects.map((row) => {
              const look = row.dominant ? MOOD_LOOK[row.dominant] : null;
              return (
                <li key={row.subject} className={styles.row}>
                  <div className={styles.line}>
                    <b>{row.subject}</b>
                    {look && row.dominant && (
                      <span className={styles.face} style={{ color: look.color }}>
                        <MoodFaceIcon variant={row.dominant} size={16} aria-hidden />
                        بیشتر {look.label}
                      </span>
                    )}
                    <span className={styles.value}>{fa(row.good)}٪ خوب</span>
                  </div>
                  <div className={styles.track} role="img"
                    aria-label={`${fa(row.good)} درصد خوب؛ میانگین ${fa(baseline)} درصد`}>
                    <i style={{ width: `${Math.max(row.good, 3)}%` }} data-dir={row.lift >= 0 ? 'up' : 'down'} />
                    <span className={styles.base} style={{ insetInlineStart: `${baseline}%` }} aria-hidden />
                  </div>
                  <small className={styles.meta}>
                    {fa(row.count)} بار ثبتِ حال · {versus(row.lift)}
                  </small>
                </li>
              );
            })}
          </ul>
          <p className={styles.legend}>
            <span className={styles.baseKey} aria-hidden /> میانگینِ حالِ خوبِ {childName}: {fa(baseline)}٪
          </p>
        </>
      )}

      {up && (
        <p className={card.insight}>
          با <b>«{up.subject}»</b> حالش بهتر می‌شود؛ بعد از بازی‌هایش {fa(up.good)}٪ وقت‌ها شاد یا آرام بوده است.
        </p>
      )}

      {learning && (
        <div className={styles.learn}>
          <p>حال و یادگیری: درصدِ پاسخ‌های درست</p>
          <div className={styles.learnRow}>
            <span data-kind="good">
              <MoodFaceIcon variant="happy" size={18} aria-hidden />
              <b>{fa(learning.good.accuracy)}٪</b>
              <small>وقتی شاد یا آرام است</small>
            </span>
            <span data-kind="low">
              <MoodFaceIcon variant="tired" size={18} aria-hidden />
              <b>{fa(learning.low.accuracy)}٪</b>
              <small>وقتی خسته یا ناراحت است</small>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
