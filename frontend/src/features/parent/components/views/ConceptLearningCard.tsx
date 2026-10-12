import { HiOutlineAcademicCap } from 'react-icons/hi2';
import type { ConceptStat, LearningSummary } from '../../types';
import { Card } from '../shell/Card';
import styles from './ConceptLearningCard.module.css';

interface Props {
  learning?: LearningSummary;
}

/** چند مفهومِ پرخطاتر؛ بقیه فقط شمرده می‌شوند تا کارت بلند نشود */
const SHOWN = 6;
const fa = (value: number) => value.toLocaleString('fa-IR');

/** نوعِ غالبِ خطا؛ اگر چند نوع هم‌تعدادند همه گفته می‌شوند تا یکی بی‌دلیل «بیشتر» نشود */
function topErrors(types: ConceptStat['errorTypes']): string {
  const max = Math.max(0, ...types.map((t) => t.count));
  return max ? types.filter((t) => t.count === max).map((t) => t.label).join(' و ') : '';
}

/**
 * یادگیری بر پایه‌ی تگ‌های آموزشی: موفقیت در اولین تلاش، خطاهای این هفته، و برای هر مفهوم
 * خطا و نوعِ غالبِ خطا. زمانِ بازی همان کاشیِ «زمان یادگیری این هفته» است و این‌جا تکرار نمی‌شود.
 */
export function ConceptLearningCard({ learning }: Props) {
  if (!learning) return null;
  const { week, concepts } = learning;
  const shown = concepts.slice(0, SHOWN);

  return (
    <Card
      icon={HiOutlineAcademicCap}
      title="یادگیریِ مفهوم‌ها"
      note="هر سؤالِ بازی یک مفهومِ آموزشی دارد؛ این‌جا خطاها و موفقیت در اولین تلاشِ هر مفهوم دیده می‌شود."
    >
      <div className={styles.stats}>
        <div className={styles.stat}>
          <small>موفقیت در اولین تلاش</small>
          <b>{week.firstTry.asked ? `${fa(week.firstTry.rate)}٪` : '—'}</b>
          <span>
            {week.firstTry.asked
              ? `${fa(week.firstTry.asked)} سؤال در هفت روزِ اخیر`
              : 'در هفت روزِ اخیر سؤالی ثبت نشده'}
          </span>
        </div>
        <div className={styles.stat}>
          <small>خطاهای این هفته</small>
          <b>{fa(week.errors)}</b>
          <span>از {fa(week.answers)} پاسخ</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>
          هنوز پاسخی با مفهومِ آموزشی ثبت نشده است؛ بازی‌های تازه این داده را می‌فرستند.
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.map((concept) => {
            // اولین تلاش گویاتر است؛ اگر بازی شماره‌ی تلاش را نفرستاده، دقتِ کل
            const useFirstTry = concept.firstTryAsked > 0;
            const rate = useFirstTry ? concept.firstTryRate : concept.accuracy;
            const topError = topErrors(concept.errorTypes);
            return (
              <li key={concept.tag} className={styles.item}>
                <div className={styles.line}>
                  <b>{concept.label}</b>
                  <span className={concept.errors ? styles.errors : styles.clean}>
                    {concept.errors ? `${fa(concept.errors)} خطا` : 'بی‌خطا'}
                  </span>
                </div>
                <div
                  className={styles.track}
                  role="img"
                  aria-label={`${useFirstTry ? 'موفقیت در اولین تلاش' : 'دقت'} ${fa(rate)} درصد`}
                >
                  <i className={rate >= 70 ? styles.fillGood : styles.fillWeak} style={{ width: `${rate}%` }} />
                </div>
                <small className={styles.meta}>
                  {useFirstTry ? `اولین تلاش ${fa(rate)}٪` : `دقت ${fa(rate)}٪`}
                  {' · '}
                  {fa(concept.answers)} پاسخ
                  {topError && ` · بیشترِ خطاها: ${topError}`}
                  {concept.hints > 0 && ` · ${fa(concept.hints)} راهنمایی`}
                </small>
              </li>
            );
          })}
        </ul>
      )}

      {concepts.length > SHOWN && (
        <p className={styles.more}>و {fa(concepts.length - SHOWN)} مفهومِ دیگر با خطای کمتر.</p>
      )}
    </Card>
  );
}
