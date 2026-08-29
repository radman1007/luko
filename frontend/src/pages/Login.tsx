import { LUKORIANS } from '@/lib/characters';
import { OtpAuthForm } from '@/features/auth/components/OtpAuthForm/OtpAuthForm';
import styles from './Login.module.css';

/**
 * دروازه‌ی شهرِ لوکو — ورود و ثبت‌نام یکی است.
 * بچه فقط شماره می‌زند و کد را تأیید می‌کند؛ بقیه‌اش را خودِ سرور می‌فهمد.
 */
export default function Login() {
  const guide = LUKORIANS.welcome;

  return (
    <main className={styles.page}>
      {/* آسمانِ شهر: تپه‌ها، ابرها و ستاره‌های شناور — فقط تزئینی */}
      <div className={styles.sky} aria-hidden>
        <span className={styles.glowOne} />
        <span className={styles.glowTwo} />
        <svg className={styles.stars} viewBox="0 0 360 220" preserveAspectRatio="none">
          <g fill="currentColor">
            <circle cx="34" cy="46" r="2.6" />
            <circle cx="300" cy="30" r="3.2" />
            <circle cx="248" cy="96" r="2" />
            <circle cx="86" cy="120" r="2.2" />
            <circle cx="330" cy="150" r="2.6" />
            <circle cx="150" cy="26" r="1.8" />
          </g>
        </svg>
        <svg className={styles.hills} viewBox="0 0 360 120" preserveAspectRatio="none">
          <path fill="currentColor" opacity="0.5"
            d="M0 78c48-26 90 6 138-10s84-34 132-16 90 22 90 22v46H0Z" />
          <path fill="currentColor"
            d="M0 96c54-20 102 8 156-6s96-24 144-8 60 12 60 12v26H0Z" />
        </svg>
      </div>

      <div className={styles.intro}>
        <div className={styles.bubble}>
          <p className={styles.speaker}>{guide.name}، {guide.role}</p>
          <p className={styles.text}>سلام! من پری‌ام. با یه شماره می‌برمت تو شهرِ لوکو.</p>
          <span className={styles.tail} aria-hidden />
        </div>
        <img className={styles.character} src={guide.image} alt={guide.name} />
      </div>

      <OtpAuthForm />
    </main>
  );
}
