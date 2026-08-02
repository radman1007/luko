import { useId } from 'react';
import type { TrendPoint } from '../../types';
import styles from './AccuracyTrend.module.css';

interface Props {
  data: TrendPoint[];
}

const W = 420;
const H = 200;
const PAD = { top: 26, right: 40, bottom: 30, left: 34 };
const PLOT_W = W - PAD.right - PAD.left;
const PLOT_H = H - PAD.top - PAD.bottom;

/** روندِ دقتِ پاسخ‌ها در هشت هفتهٔ گذشته — یک سری، خطی. RTL: قدیمی‌ترین سمتِ راست */
export function AccuracyTrend({ data }: Props) {
  const gradientId = useId();
  const last = data[data.length - 1];
  const first = data[0];
  const change = last.value - first.value;

  const x = (i: number) => W - PAD.right - (i / (data.length - 1)) * PLOT_W;
  const y = (value: number) => PAD.top + PLOT_H - (value / 100) * PLOT_H;

  const line = data.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(point.value)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;

  return (
    <figure className={styles.figure}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار روند دقت پاسخ‌ها">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pp-blue)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--pp-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.tick} x={W - PAD.right + 8} y={y(tick) + 4}>
              {tick.toLocaleString('fa-IR')}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path className={styles.line} d={line} />

        {data.map((point, i) => (
          <g key={point.label} className={styles.point}>
            <title>
              {point.label} — دقت {point.value.toLocaleString('fa-IR')}٪
            </title>
            <circle className={styles.hit} cx={x(i)} cy={y(point.value)} r={12} />
            <circle className={styles.dot} cx={x(i)} cy={y(point.value)} r={3} />
          </g>
        ))}

        {/* نقطهٔ آخر با حلقهٔ سفید و برچسبِ مستقیم */}
        <circle className={styles.lastDot} cx={x(data.length - 1)} cy={y(last.value)} r={5} />
        <text className={styles.lastLabel} x={x(data.length - 1)} y={y(last.value) - 14}>
          {last.value.toLocaleString('fa-IR')}٪
        </text>

        <text className={styles.axisNote} x={W - PAD.right} y={H - 10}>
          {first.label}
        </text>
        <text className={`${styles.axisNote} ${styles.axisNoteEnd}`} x={PAD.left} y={H - 10}>
          {last.label}
        </text>
      </svg>
      <figcaption className={styles.caption}>
        {change >= 0 ? 'رشد' : 'افت'} {Math.abs(change).toLocaleString('fa-IR')} واحدی نسبت به هشت هفته پیش
      </figcaption>
    </figure>
  );
}
