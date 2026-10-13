import { HiOutlineCheckCircle, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import type { Assignment } from '../../api';
import styles from './DailyCard.module.css';

interface Props {
  childName: string;
  /** بازی‌ای که برای امروز گذاشته شده (یا null) */
  today: Assignment | null;
  onOpen: () => void;
}

/** «بازیِ امروز»: والد یک بازی برای امروزِ بچه می‌گذارد و بچه اول همان را می‌بیند */
export function DailyCard({ childName, today, onOpen }: Props) {
  return (
    <section className={styles.card} aria-labelledby="daily-title">
      <span className={styles.icon} aria-hidden><HiOutlinePuzzlePiece /></span>
      <div className={styles.main}>
        <h2 id="daily-title">بازیِ امروزِ {childName}</h2>
        {today ? (
          <p>
            <b>{today.gameTitle}</b>
            {today.played ? (
              <span className={styles.done}><HiOutlineCheckCircle aria-hidden /> انجامش داد</span>
            ) : (
              <span className={styles.wait}>منتظرِ بازی</span>
            )}
          </p>
        ) : (
          <p>یک بازی برای امروزش انتخاب کنید؛ وقتی وارد لوکو شود اول همین را می‌بیند.</p>
        )}
      </div>
      <button type="button" className={styles.cta} onClick={onOpen}>
        {today ? 'تغییر' : 'انتخابِ بازی'}
      </button>
    </section>
  );
}
