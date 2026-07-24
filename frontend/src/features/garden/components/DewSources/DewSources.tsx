import {
  HiOutlineClock,
  HiOutlinePuzzlePiece,
  HiOutlineFlag,
  HiOutlineTrophy,
  HiOutlineAcademicCap,
  HiOutlineUsers,
} from 'react-icons/hi2';
import { DewIcon } from '@/components/ui/icons';
import type { DewEntry, DewSource } from '../../types';
import styles from './DewSources.module.css';

const SOURCE_LABEL: Record<DewSource, string> = {
  time: 'وقتی توی سایت می‌مونی',
  game: 'کامل کردن بازی‌ها',
  mission: 'مأموریت‌های باشگاه',
  medal: 'گرفتن مدال تازه',
  teacher: 'جایزه‌ی معلم',
  parent: 'جایزه‌ی والدین',
  shop: 'فروشگاه',
  seed: 'کاشت دانه',
};

const SOURCES = [
  { icon: HiOutlinePuzzlePiece, text: 'بازی‌ها و مرحله‌ها را کامل کن' },
  { icon: HiOutlineFlag, text: 'مأموریت‌های روزانه‌ی باشگاه' },
  { icon: HiOutlineTrophy, text: 'هر مدال تازه‌ای که می‌گیری' },
  { icon: HiOutlineAcademicCap, text: 'جایزه‌ی معلم و مربی' },
  { icon: HiOutlineUsers, text: 'جایزه‌ی پدر و مادر' },
  { icon: HiOutlineClock, text: 'هر چه بیشتر بمانی، بیشتر می‌گیری' },
] as const;

function ago(at: number): string {
  const m = Math.floor((Date.now() - at) / 60_000);
  if (m < 1) return 'همین الان';
  if (m < 60) return `${m.toLocaleString('fa-IR')} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h.toLocaleString('fa-IR')} ساعت پیش`;
  return `${Math.floor(h / 24).toLocaleString('fa-IR')} روز پیش`;
}

interface Props {
  dewLog: DewEntry[];
}

/** شبنم از کجا می‌آید + آخرین شبنم‌های دریافتی */
export function DewSources({ dewLog }: Props) {
  return (
    <section className={styles.wrap} aria-label="راه‌های گرفتن شبنم">
      <h2 className={styles.title}>
        <DewIcon size={18} aria-hidden />
        شبنم از کجا میاد؟
      </h2>

      <ul className={styles.sources}>
        {SOURCES.map(({ icon: Icon, text }) => (
          <li key={text} className={styles.source}>
            <Icon className={styles.sourceIcon} aria-hidden />
            {text}
          </li>
        ))}
      </ul>

      {dewLog.length > 0 && (
        <div className={styles.log}>
          <p className={styles.logTitle}>آخرین شبنم‌ها</p>
          <ul className={styles.logList}>
            {dewLog.slice(0, 5).map((e, i) => (
              <li key={i} className={styles.logItem}>
                <span className={styles.logSource}>{SOURCE_LABEL[e.source]}</span>
                <span className={styles.logMeta}>
                  <span className={styles.logAmount}>+{e.amount.toLocaleString('fa-IR')}</span>
                  <span className={styles.logAgo}>{ago(e.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
