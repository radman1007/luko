import {
  HiOutlineArrowTrendingDown,
  HiOutlineArrowTrendingUp,
  HiOutlineInformationCircle,
  HiOutlineMinusSmall,
} from 'react-icons/hi2';
import type { Kpi } from '../../types';
import styles from './KpiRow.module.css';

interface Props {
  items: Kpi[];
}

function deltaClass(delta: number, higherIsBetter: boolean): string {
  if (delta === 0) return styles.deltaFlat;
  return delta > 0 === higherIsBetter ? styles.deltaGood : styles.deltaBad;
}

/** کاشی‌های آمارِ کلیدیِ هفته — عدد، واحد و تغییر نسبت به هفتهٔ گذشته */
export function KpiRow({ items }: Props) {
  return (
    <div className={styles.grid}>
      {items.map((kpi) => {
        const delta = kpi.delta ?? 0;
        const Trend =
          delta === 0 ? HiOutlineMinusSmall : delta > 0 ? HiOutlineArrowTrendingUp : HiOutlineArrowTrendingDown;

        return (
          <article key={kpi.key} className={styles.tile}>
            <p className={styles.label}>
              {kpi.label}
              {kpi.hint && (
                <span className={styles.info} title={kpi.hint}>
                  <HiOutlineInformationCircle size={14} aria-hidden />
                </span>
              )}
            </p>
            <p className={styles.value}>
              {kpi.value.toLocaleString('fa-IR')}
              {kpi.unit && <span className={styles.unit}>{kpi.unit}</span>}
            </p>
            <p className={deltaClass(delta, kpi.higherIsBetter ?? true)}>
              <Trend size={14} aria-hidden />
              {delta === 0
                ? 'بدون تغییر'
                : `${Math.abs(delta).toLocaleString('fa-IR')}٪ ${delta > 0 ? 'بیشتر' : 'کمتر'} از هفتهٔ قبل`}
            </p>
          </article>
        );
      })}
    </div>
  );
}
