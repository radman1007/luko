import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlineSparkles } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import type { Lukorian } from '@/lib/characters';
import styles from './AboutCard.module.css';

// «دانا» (science) هنوز تصویر ندارد → از رژه‌ی درباره‌ی ما حذف می‌شود (در بقیه‌ی اپ می‌ماند)
const HIDDEN_IN_PARADE = new Set(['science']);
const RESIDENTS = Object.values(LUKORIANS).filter((r) => !HIDDEN_IN_PARADE.has(r.id));
const ROW_A = RESIDENTS.slice(0, Math.ceil(RESIDENTS.length / 2));
const ROW_B = RESIDENTS.slice(Math.ceil(RESIDENTS.length / 2));

const CITY_STATS = [
  { value: RESIDENTS.length, label: 'لوکوریان' },
  { value: 6, label: 'دنیای بازی' },
  { value: '∞', label: 'ماجرا' },
];

/** یک ردیفِ رژه که بی‌وقفه حرکت می‌کند (لیست دوبار تکرار می‌شود تا حلقه بی‌درز باشد) */
function ParadeRow({ residents, reverse }: { residents: Lukorian[]; reverse?: boolean }) {
  const loop = [...residents, ...residents];
  return (
    <div className={styles.parade}>
      <div className={`${styles.track} ${reverse ? styles.reverse : ''}`}>
        {loop.map((r, i) => (
          <span key={`${r.id}-${i}`} className={styles.member} title={`${r.name} — ${r.role}`}>
            <span className={styles.avatarRing} data-initial={r.name.slice(0, 1)}>
              <img
                className={styles.avatar}
                src={r.image}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </span>
            <span className={styles.memberName}>{r.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** درباره‌ی ما — به روایتِ خودِ شهر، با رژه‌ی زنده‌ی ساکنان */
export function AboutCard() {
  const navigate = useNavigate();

  return (
    <section className={styles.card} aria-label="درباره‌ی شهر لوکو">
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <p className={styles.kicker}>
          <HiOutlineSparkles aria-hidden />
          پرونده‌ی شهر لوکو
        </p>
        <h2 className={styles.title}>یه شهر پر از دوست!</h2>
        <p className={styles.tagline}>ساکن‌هاش رو «لوکوریان» صدا می‌زنن</p>
      </header>

      {/* رژه‌ی زنده‌ی لوکوریان‌ها */}
      <div className={styles.parades}>
        <ParadeRow residents={ROW_A} />
        <ParadeRow residents={ROW_B} reverse />
      </div>

      <p className={styles.story}>
        یه جایی بین کتاب‌ها و خواب‌های قشنگ، شهریه که هر گوشه‌ش یه دوست تازه داره: دکترش حالِ
        دلت رو می‌پرسه، مربی‌ش باهات کل‌کل می‌کنه، دانشمندش برات بازی می‌سازه و سرآشپزش قصه‌ی
        خوراکی می‌گه.
      </p>

      {/* شناسنامه‌ی شهر */}
      <div className={styles.stats}>
        {CITY_STATS.map((s) => (
          <div key={s.label} className={styles.stat}>
            <b className={styles.statValue}>
              {typeof s.value === 'number' ? s.value.toLocaleString('fa-IR') : s.value}
            </b>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* جای خالیِ کاربر */}
      <button type="button" className={styles.youRow} onClick={() => navigate('/profile')}>
        <span className={styles.youSlot} aria-hidden>
          <HiOutlinePlus />
        </span>
        <span className={styles.youTexts}>
          <span className={styles.youTitle}>و یه جای خالی مونده... مالِ تو!</span>
          <span className={styles.youDesc}>لوکوریانِ خودت رو بساز و عضو شهر شو</span>
        </span>
      </button>

      <p className={styles.footer}>لوکو — شهر یادگیری و بازی</p>
    </section>
  );
}
