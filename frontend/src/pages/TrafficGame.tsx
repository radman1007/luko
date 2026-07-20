import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineChevronRight, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { trafficRuleById } from '@/features/home/trafficRules';
import styles from './TrafficGame.module.css';

/**
 * بازیِ عملیِ قانونِ راهنمایی و رانندگی.
 * TODO: برای هر قانون یک بازیِ HTML5 مخصوص ساخته می‌شود؛
 * وقتی آماده شد، به‌جای صفحه‌ی «به‌زودی» داخل همین قاب (iframe با sandbox) بارگذاری می‌شود.
 */
export default function TrafficGame() {
  const navigate = useNavigate();
  const { ruleId = '' } = useParams();
  const officer = LUKORIANS.traffic;
  const rule = trafficRuleById(ruleId);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label="بازگشت به خانه"
        >
          <HiOutlineChevronRight />
        </button>
        <span className={styles.topTitle}>مدرسه‌ی راهنمایی سروان راه</span>
      </header>

      <section className={styles.stage}>
        <img className={styles.character} src={officer.image} alt={officer.name} />

        <div className={styles.ruleCard}>
          <p className={styles.ruleKicker}>قانونِ این بازی</p>
          <p className={styles.ruleText}>{rule?.text ?? 'این قانون پیدا نشد!'}</p>
        </div>

        {rule?.hasGame ? (
          // TODO: بازیِ واقعی این‌جا (iframe با sandbox) بارگذاری می‌شود
          <div className={styles.gameSlot} aria-label="بازی" />
        ) : (
          <div className={styles.soon}>
            <span className={styles.soonIcon} aria-hidden>
              <HiOutlineWrenchScrewdriver />
            </span>
            <p className={styles.soonTitle}>بازیِ این قانون به‌زودی می‌رسه!</p>
            <p className={styles.soonDesc}>
              سروان راه داره یه بازیِ باحال می‌سازه تا این قانون رو با تمرین یاد بگیری. یه کم صبر کن!
            </p>
            <button type="button" className={styles.soonBtn} onClick={() => navigate('/')}>
              برگردیم خونه
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
