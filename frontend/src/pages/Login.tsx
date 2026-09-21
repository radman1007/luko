import { BrandMark } from '@/components/ui/icons';
import { GateDuo } from '@/features/auth/components/GateDuo/GateDuo';
import { OtpAuthForm } from '@/features/auth/components/OtpAuthForm/OtpAuthForm';
import styles from './Login.module.css';

/** شکلِ ابر — همان ابرِ نقشه‌ی بازی‌ها */
const CLOUD =
  'M46 88c-19 0-34-13-34-30 0-15 12-27 27-29 4-17 20-29 39-29 16 0 30 9 37 22 5-3 11-5 17-5 17 0 31 13 32 29 15 2 26 14 26 29 0 8-4 13-4 13H46Z';

/**
 * دروازه‌ی شهرِ لوکو — ورود و ثبت‌نام یکی است.
 * بچه فقط شماره می‌زند و کد را تأیید می‌کند؛ بقیه‌اش را خودِ سرور می‌فهمد.
 *
 * پری (با نقشه) و داداشش پویا (با قطب‌نما) دمِ دروازه منتظرند. آسمان، تپه‌ها
 * و جاده‌ی خط‌چینی که به شهر می‌رسد حالِ «سفر» دارد، نه صورتی و نه آبی.
 */
export default function Login() {
  return (
    <main className={styles.page}>
      {/* آسمان و افقِ شهر — فقط تزئینی */}
      <div className={styles.sky} aria-hidden>
        <span className={styles.sun} />
        <svg className={`${styles.cloud} ${styles.cloudOne}`} viewBox="0 0 220 90">
          <path fill="currentColor" d={CLOUD} />
        </svg>
        <svg className={`${styles.cloud} ${styles.cloudTwo}`} viewBox="0 0 220 90">
          <path fill="currentColor" d={CLOUD} />
        </svg>
        <svg className={`${styles.cloud} ${styles.cloudThree}`} viewBox="0 0 220 90">
          <path fill="currentColor" d={CLOUD} />
        </svg>
        {/* درخشش‌های چهارپر، مثلِ ستاره‌ی قطب‌نمای پویا */}
        {[styles.sparkOne, styles.sparkTwo, styles.sparkThree].map((spot) => (
          <svg key={spot} className={`${styles.spark} ${spot}`} viewBox="0 0 20 20">
            <path fill="currentColor" d="M10 0l2.6 7.4L20 10l-7.4 2.6L10 20l-2.6-7.4L0 10l7.4-2.6Z" />
          </svg>
        ))}
        <span className={styles.city} />
        <svg className={styles.hills} viewBox="0 0 360 130" preserveAspectRatio="none">
          <path className={styles.hillBack} d="M0 70c50-30 104-22 150-6s96 18 138-4 72-14 72-14v84H0Z" />
          <path className={styles.hillFront} d="M0 92c60-22 118-10 176-2s112 6 184-20v60H0Z" />
          {/* جاده‌ی خط‌چین — از پایینِ صفحه تا دلِ شهر */}
          <path
            className={styles.trail}
            d="M40 130c30-14 70-18 104-24s62-16 84-30"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <p className={styles.brand}>
        <BrandMark size={22} aria-hidden />
        لوکو
      </p>

      <div className={styles.gate}>
        <GateDuo />
        <OtpAuthForm />
      </div>
    </main>
  );
}
