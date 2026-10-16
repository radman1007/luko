import {
  HiOutlineArrowTrendingUp, HiOutlineChartBar, HiOutlineClock, HiOutlineListBullet, HiOutlineLockClosed,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import styles from './DetailsLocked.module.css';

interface Props {
  childName: string;
  onUpgrade: () => void;
}

const INSIDE = [
  { icon: HiOutlineSparkles, text: 'تحلیلِ هوشمندِ هفته با نقطه‌ی قوت و زمینه‌ی نیازمندِ توجه' },
  { icon: HiOutlineArrowTrendingUp, text: 'روندِ دقتِ هشت هفته و تسلط در هر درس' },
  { icon: HiOutlineChartBar, text: 'دقیقه‌های بازیِ هر روز و ساعت‌های پرکارِ شبانه‌روز' },
  { icon: HiOutlineClock, text: 'همه‌ی جلسه‌های بازی با آمارِ ریزِ هر بازی' },
  { icon: HiOutlineListBullet, text: 'مبحث‌های پرخطا و پیشنهادِ تمرین برای هرکدام' },
];

/**
 * «گزارشِ کامل» (جزئیاتِ بیشتر) در نسخه‌ی رایگان قفل است (۲۵ مهر ۱۴۰۵، به خواستِ کاربر): به‌جای گزارش،
 * فهرستِ آنچه با اشتراک باز می‌شود. داده‌ای از گزارشِ کامل این‌جا نشان داده نمی‌شود.
 */
export function DetailsLocked({ childName, onUpgrade }: Props) {
  return (
    <section className={styles.card} aria-labelledby="details-locked">
      <span className={styles.badge} aria-hidden><HiOutlineLockClosed /></span>
      <h2 id="details-locked">گزارشِ کاملِ {childName} با اشتراک باز می‌شود</h2>
      <p>خلاصه‌ی هفته و وضعیتِ درس‌ها در خانه برای همه باز است؛ جزئیاتِ بیشتر ویژه‌ی اشتراک است:</p>
      <ul>
        {INSIDE.map(({ icon: Icon, text }) => (
          <li key={text}><span aria-hidden><Icon /></span>{text}</li>
        ))}
      </ul>
      <button type="button" onClick={onUpgrade}>
        <CrownIcon size={18} strokeWidth={2} aria-hidden /> دیدنِ اشتراک
      </button>
    </section>
  );
}
