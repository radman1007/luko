import { useState } from 'react';
import { HiOutlineCodeBracket, HiOutlineCpuChip, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import styles from './CodingTeaser.module.css';

/**
 * آکادمی کد لوکو — آموزش برنامه‌نویسی بلوکی (به سبک اسکرچ).
 * TODO: بعد از رسیدن کاراکتر مخصوص این بخش، تم و تصویرش جایگزین می‌شود.
 */
export function CodingTeaser() {
  const [soon, setSoon] = useState(false);

  return (
    <section className={styles.card} aria-label="آکادمی کد لوکو">
      <div className={styles.window}>
        <span className={styles.dots} aria-hidden>
          <i /> <i /> <i />
        </span>
        <span className={styles.windowTitle}>luko-academy.code</span>
      </div>

      <div className={styles.body}>
        <div className={styles.codeLines} aria-hidden>
          <p>
            <span className={styles.kw}>وقتی</span> <span className={styles.fn}>پرچم</span> کلیک شد
          </p>
          <p>
            <span className={styles.kw}>تکرار</span> <span className={styles.num}>۱۰</span> بار
          </p>
          <p className={styles.indent}>
            <span className={styles.fn}>برو</span> جلو <span className={styles.num}>۵</span> قدم
          </p>
          <p className={styles.indent}>
            <span className={styles.fn}>بگو</span> <span className={styles.str}>«سلام لوکو!»</span>
            <span className={styles.cursor} />
          </p>
        </div>

        <h2 className={styles.title}>
          <HiOutlineCodeBracket aria-hidden />
          آکادمی کد لوکو
        </h2>
        <p className={styles.desc}>
          اینجا با بلوک‌های رنگی مثل لگو برنامه می‌سازیم؛ به آدمک‌ها فرمان می‌دی، بازی خودت رو
          خودت می‌سازی و آخرش می‌شی مهندس شهر لوکو!
        </p>
        <div className={styles.features} aria-hidden>
          <span className={styles.feature}>
            <HiOutlinePuzzlePiece /> بلوک‌چینی
          </span>
          <span className={styles.feature}>
            <HiOutlineCpuChip /> ربات‌بازی
          </span>
        </div>

        <button type="button" className={styles.cta} onClick={() => setSoon(true)}>
          {soon ? 'به‌زودی!' : 'بزن بریم کد بزنیم'}
        </button>
      </div>
    </section>
  );
}
