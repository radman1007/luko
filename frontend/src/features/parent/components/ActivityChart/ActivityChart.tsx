import type { DayActivity } from '../../types';
import styles from './ActivityChart.module.css';

interface Props {
  data: DayActivity[];
}

const W = 720;
const H = 236;
const PAD = { top: 22, right: 46, bottom: 38, left: 12 };
const PLOT_W = W - PAD.right - PAD.left;
const PLOT_H = H - PAD.top - PAD.bottom;
const BAR_MAX = 24;

/** مستطیل با سرِ گردِ ۴ پیکسلی و پایهٔ صاف روی خطِ صفر */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h);
  return `M${x} ${y + h} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h} Z`;
}

/** سقفِ محورِ عمودی — رُند به مضربِ ۱۰ تا برچسب‌ها تمیز بمانند */
function niceMax(values: number[]): number {
  const max = Math.max(10, ...values);
  return Math.ceil(max / 10) * 10;
}

/**
 * زمانِ فعالیت در هفت روزِ گذشته — یک سریِ داده، ستونی.
 * RTL: شنبه سمتِ راست، جمعه سمتِ چپ.
 */
export function ActivityChart({ data }: Props) {
  const max = niceMax(data.map((d) => d.minutes));
  const band = PLOT_W / data.length;
  const barW = Math.min(BAR_MAX, band * 0.42);
  const total = data.reduce((sum, d) => sum + d.minutes, 0);
  const avg = Math.round(total / data.length);
  const peak = Math.max(...data.map((d) => d.minutes));

  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <figure className={styles.figure}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار زمان فعالیت روزانه">
        {/* خطوطِ راهنما و برچسبِ محور — سمتِ راست، مطابق RTL */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.tick} x={W - PAD.right + 8} y={y(tick) + 4}>
              {tick.toLocaleString('fa-IR')}
            </text>
          </g>
        ))}

        {/* میانگینِ هفته */}
        <line className={styles.avgLine} x1={PAD.left} x2={W - PAD.right} y1={y(avg)} y2={y(avg)} />
        <text className={styles.avgLabel} x={PAD.left + 4} y={y(avg) - 7}>
          میانگین {avg.toLocaleString('fa-IR')} دقیقه
        </text>

        {data.map((day, i) => {
          const cx = W - PAD.right - band * (i + 0.5);
          const h = (day.minutes / max) * PLOT_H;
          const top = PAD.top + PLOT_H - h;
          const isPeak = day.minutes === peak;

          return (
            <g key={day.day} className={styles.col}>
              <title>
                {day.day} — {day.minutes.toLocaleString('fa-IR')} دقیقه، {day.games.toLocaleString('fa-IR')} بازی
              </title>
              <rect className={styles.hit} x={cx - band / 2} y={PAD.top} width={band} height={PLOT_H} />
              {h > 0 && <path className={isPeak ? styles.barPeak : styles.bar} d={bar(cx - barW / 2, top, barW, h)} />}
              {isPeak && (
                <text className={styles.peakLabel} x={cx} y={top - 8}>
                  {day.minutes.toLocaleString('fa-IR')}
                </text>
              )}
              <text className={styles.dayLabel} x={cx} y={H - 14}>
                {day.day}
              </text>
            </g>
          );
        })}

        <line className={styles.baseline} x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
      </svg>
      <figcaption className={styles.caption}>
        مجموع این هفته: <b>{total.toLocaleString('fa-IR')} دقیقه</b> — واحد محور: دقیقه در روز
      </figcaption>
    </figure>
  );
}
