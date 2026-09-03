import { HiOutlineHeart, HiOutlineLockClosed } from 'react-icons/hi2';
import { MoodFaceIcon } from 'components/ui/icons';
import type { MoodVariant } from 'components/ui/icons';
import type { ChildReport } from '../../types';
import { Card, SectionTitle } from '../shell/Card';
import styles from './HealthView.module.css';

interface Props {
  report: ChildReport;
  childName: string;
}

const MOOD_TEXT: Record<MoodVariant, string> = {
  happy: 'خوشحال',
  calm: 'آرام',
  tired: 'خسته',
  sad: 'ناراحت',
  angry: 'عصبانی',
};

const MOOD_CLASS: Record<MoodVariant, string> = {
  happy: styles.moodHappy,
  calm: styles.moodCalm,
  tired: styles.moodMeh,
  sad: styles.moodSad,
  angry: styles.moodSad,
};

/** سلامت و روحیه — بدونِ نمایشِ محتوای خصوصیِ بچه */
export function HealthView({ report, childName }: Props) {
  const { wellbeing, moods } = report;
  const activeDays = new Set(moods.map((entry) => entry.day)).size;

  const tiles = [
    { value: wellbeing.checkins.toLocaleString('fa-IR'), label: 'ثبت حال' },
    { value: wellbeing.breathingSessions.toLocaleString('fa-IR'), label: 'تمرین تنفس' },
    { value: wellbeing.paintings.toLocaleString('fa-IR'), label: 'نقاشی' },
    // بدونِ ثبتِ حال، «حال غالب» ساختگی است؛ خط تیره صادق‌تر است
    {
      value: wellbeing.checkins > 0 ? MOOD_TEXT[wellbeing.dominantMood] : '—',
      label: 'حال غالب',
      text: true,
    },
  ];

  return (
    <>
      <SectionTitle>سلامت و روحیهٔ {childName}</SectionTitle>

      <Card
        icon={HiOutlineHeart}
        title="حال و روحیه"
        note="حال روزانه و فعالیت‌های آرام‌سازی در دو هفتهٔ گذشته."
      >
        <div className={styles.tiles}>
          {tiles.map((tile) => (
            <div key={tile.label} className={styles.tile}>
              <b className={tile.text ? styles.tileText : undefined}>{tile.value}</b>
              <span>{tile.label}</span>
            </div>
          ))}
        </div>

        {moods.length === 0 ? (
          <p className={styles.empty}>
            هنوز حالی ثبت نشده است. {childName} می‌تواند از بخشِ لوکو سلامت حالش را ثبت کند.
          </p>
        ) : (
          <>
            <div className={styles.stripHead}>
              <small>۱۴ روز گذشته</small>
              <small>{activeDays.toLocaleString('fa-IR')} روز ثبت‌شده</small>
            </div>
            <div className={styles.strip}>
              {moods.map((entry, i) => (
                <span
                  key={`${entry.day}-${i}`}
                  className={MOOD_CLASS[entry.mood]}
                  title={`روز ${entry.day} — ${MOOD_TEXT[entry.mood]}`}
                >
                  <MoodFaceIcon variant={entry.mood} size={18} aria-hidden />
                  {entry.day}
                </span>
              ))}
            </div>
          </>
        )}

        <p className={styles.privacy}>
          <HiOutlineLockClosed aria-hidden />
          <span>
            نوشته‌های «صندوقچهٔ رازها» رمزنگاری شده‌اند و برای هیچ‌کس — از جمله شما — قابل دیدن
            نیستند.
          </span>
        </p>
      </Card>
    </>
  );
}
