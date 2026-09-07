import { useEffect, useMemo, useState } from 'react';
import { HiOutlineLockClosed, HiOutlineXMark } from 'react-icons/hi2';
import { CATEGORY_LABEL, nextMedal } from '@/features/club/medals';
import type { Medal, MedalCategory } from '@/features/club/medals';
import styles from './TrophyHall.module.css';

interface Props {
  medals: Medal[];
}

const ORDER: MedalCategory[] = ['mission', 'streak', 'game', 'club', 'craft'];

const TIER_LABEL = { bronze: 'برنز', silver: 'نقره', gold: 'طلا' } as const;

/** ۳ → «۳» */
const fa = (n: number) => n.toLocaleString('fa-IR');

/**
 * تالارِ افتخارات.
 *
 * دو تصمیمِ اصلی:
 *
 *   - مدالِ بسته **پنهان نمی‌شود**. سایه‌اش می‌ماند و نوارِ پیشرفتش
 *     می‌گوید چقدر تا رسیدن مانده؛ همین است که بچه را برمی‌گرداند.
 *     تالارِ خالی از قفل، تالارِ بی‌هدف است.
 *   - رتبه (برنز/نقره/طلا) فقط رنگ نیست: قابِ هر مدال و نوشته‌اش هم
 *     فرق می‌کند، تا برای بچه‌ای که رنگ را تشخیص نمی‌دهد هم پیدا باشد.
 */
export function TrophyHall({ medals }: Props) {
  const [open, setOpen] = useState<Medal | null>(null);

  const unlocked = medals.filter((m) => m.unlocked);
  const gold = unlocked.filter((m) => m.tier === 'gold').length;
  const almost = useMemo(() => nextMedal(medals), [medals]);

  // بستن با Esc — همان انتظارِ همیشگیِ یک پنجره
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const groups = useMemo(
    () =>
      ORDER.map((category) => ({
        category,
        rows: medals.filter((m) => m.category === category),
      })).filter((g) => g.rows.length > 0),
    [medals],
  );

  return (
    <section className={styles.hall} aria-label="تالار افتخارات">
      {/* ── سردر ─────────────────────────────────────────── */}
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>تالارِ افتخارات</h2>
          <p className={styles.sub}>
            {unlocked.length === 0
              ? 'هنوز خالیه — اولین مدالت منتظرته!'
              : `${fa(unlocked.length)} مدال از ${fa(medals.length)} تا`}
          </p>
        </div>

        <div className={styles.counters}>
          <span className={styles.counter}>
            <b>{fa(unlocked.length)}</b>
            <small>مدال</small>
          </span>
          <span className={`${styles.counter} ${styles.goldCounter}`}>
            <b>{fa(gold)}</b>
            <small>طلا</small>
          </span>
        </div>
      </header>

      <div className={styles.track} aria-hidden>
        <span
          className={styles.fill}
          style={{ width: `${medals.length ? (unlocked.length / medals.length) * 100 : 0}%` }}
        />
      </div>

      {/* نزدیک‌ترین مدال — یک هدفِ روشن، نه فهرستی از آرزوها */}
      {almost && (
        <p className={styles.almost}>
          <span className={styles.almostIcon} aria-hidden>
            <almost.icon />
          </span>
          نزدیک‌ترین مدالت: <b>{almost.title}</b> — {fa(almost.target - almost.current)} تا مونده!
        </p>
      )}

      {/* ── ویترین ───────────────────────────────────────── */}
      {groups.map(({ category, rows }) => (
        <div key={category} className={styles.group}>
          <h3 className={styles.groupTitle}>{CATEGORY_LABEL[category]}</h3>
          <ul className={styles.grid}>
            {rows.map((medal) => (
              <li key={medal.id}>
                <button
                  type="button"
                  className={`${styles.slot} ${styles[medal.tier]} ${medal.unlocked ? styles.won : styles.locked}`}
                  onClick={() => setOpen(medal)}
                  aria-label={
                    `${medal.title}، ${TIER_LABEL[medal.tier]}، ` +
                    (medal.unlocked
                      ? 'گرفته‌شده'
                      : `${fa(medal.current)} از ${fa(medal.target)} — ${medal.description}`)
                  }
                >
                  <span className={styles.plate} aria-hidden>
                    <span className={styles.badge}>
                      {medal.unlocked ? <medal.icon /> : <HiOutlineLockClosed />}
                    </span>
                    {medal.unlocked && <span className={styles.shine} />}
                  </span>

                  <span className={styles.name}>{medal.title}</span>

                  {medal.unlocked ? (
                    <span className={styles.tierTag}>{TIER_LABEL[medal.tier]}</span>
                  ) : (
                    <>
                      <span className={styles.mini} aria-hidden>
                        <span className={styles.miniFill} style={{ width: `${medal.ratio * 100}%` }} />
                      </span>
                      <span className={styles.count}>
                        {fa(medal.current)}<i>/</i>{fa(medal.target)}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* ── جزئیات ───────────────────────────────────────── */}
      {open && (
        /* پس‌زمینه فقط پرده است؛ خودِ کارت دیالوگ است. برعکسش صفحه‌خوان
           را گیج می‌کند و کلِ پرده را یک پنجره می‌خواند. */
        <div className={styles.backdrop} onClick={() => setOpen(null)}>
          {/* کلیک روی خودِ کارت نباید ببنددش */}
          <div
            className={`${styles.sheet} ${styles[open.tier]}`}
            role="dialog"
            aria-modal="true"
            aria-label={open.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.close} onClick={() => setOpen(null)} aria-label="بستن">
              <HiOutlineXMark />
            </button>

            <span className={`${styles.plate} ${styles.bigPlate} ${open.unlocked ? styles.won : styles.locked}`} aria-hidden>
              <span className={styles.badge}>
                {open.unlocked ? <open.icon /> : <HiOutlineLockClosed />}
              </span>
              {open.unlocked && <span className={styles.shine} />}
            </span>

            <p className={styles.sheetTier}>{TIER_LABEL[open.tier]} · {CATEGORY_LABEL[open.category]}</p>
            <h3 className={styles.sheetTitle}>{open.title}</h3>
            <p className={styles.sheetDesc}>{open.description}</p>

            {open.unlocked ? (
              <p className={styles.sheetWon}>این مدال مالِ توئه!</p>
            ) : (
              <>
                <div className={styles.sheetTrack} aria-hidden>
                  <span className={styles.sheetFill} style={{ width: `${open.ratio * 100}%` }} />
                </div>
                <p className={styles.sheetLeft}>
                  {fa(open.current)} از {fa(open.target)} — {fa(open.target - open.current)} تا مونده
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
