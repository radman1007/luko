import type { CSSProperties } from 'react';
import type { TrendPoint } from '../../types';
import styles from './TrendChart.module.css';

interface Props {
  points: TrendPoint[];
}

const W = 340;
const H = 170;
const LEFT = 12;
const RIGHT = 34;

/**
 * روندِ دقت در هشت هفته. هفته‌ی بدونِ پاسخ (`samples === 0`) دقتِ صفر نیست —
 * نقطه‌اش کشیده نمی‌شود و خط از رویش خط‌چین رد می‌شود.
 */
export function TrendChart({ points }: Props) {
  const real = points.filter((point) => (point.samples ?? 1) > 0);

  if (real.length === 0) {
    return (
      <p className={styles.empty}>
        هنوز پاسخی ثبت نشده است؛ بعد از چند بازی، روندِ دقت در هشت هفته‌ی گذشته اینجا کشیده می‌شود.
      </p>
    );
  }

  const step = points.length > 1 ? (W - LEFT - RIGHT) / (points.length - 1) : 0;
  // RTL: هفته‌ی قدیمی‌تر سمت راست، تازه‌ترین سمت چپ
  const x = (i: number) => W - RIGHT - i * step;
  const y = (value: number) => 12 + (1 - value / 100) * (H - 52);

  const segments: { d: string; gap: boolean }[] = [];
  let previous: { i: number; point: TrendPoint } | null = null;
  points.forEach((point, i) => {
    const hasData = (point.samples ?? 1) > 0;
    if (!hasData) return;
    if (previous) {
      segments.push({
        d: `M ${x(previous.i)} ${y(previous.point.value)} L ${x(i)} ${y(point.value)}`,
        gap: i - previous.i > 1,
      });
    }
    previous = { i, point };
  });

  const first = real[0];
  const last = real[real.length - 1];
  const change = last.value - first.value;

  const areaPoints = points
    .map((point, i) => ({ point, i }))
    .filter(({ point }) => (point.samples ?? 1) > 0);
  const areaLine = areaPoints
    .map(({ point, i }, index) => `${index ? 'L' : 'M'} ${x(i)} ${y(point.value)}`)
    .join(' ');
  const area = `${areaLine} L ${x(areaPoints[areaPoints.length - 1].i)} ${H - 28} L ${x(areaPoints[0].i)} ${H - 28} Z`;

  return (
    <>
      <p className={styles.big}>
        {last.value.toLocaleString('fa-IR')}
        <span>٪</span>
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="روند دقت">
        <defs>
          <linearGradient id="pp-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[100, 50, 0].map((value) => (
          <g key={value}>
            <line x1={LEFT} y1={y(value)} x2={W - RIGHT + 8} y2={y(value)} stroke="#e7ebf3" />
            <text x={W - 4} y={y(value) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {value.toLocaleString('fa-IR')}
            </text>
          </g>
        ))}

        <path className={styles.area} d={area} fill="url(#pp-trend)" />

        {segments.map((segment, i) => (
          <path
            key={i}
            d={segment.d}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={segment.gap ? '5 6' : undefined}
            opacity={segment.gap ? 0.45 : 1}
          />
        ))}

        {points.map((point, i) =>
          (point.samples ?? 1) > 0 ? (
            <circle
              key={point.label}
              className={styles.dot}
              style={{ animationDelay: `${300 + i * 130}ms` } as CSSProperties}
              cx={x(i)}
              cy={y(point.value)}
              r={point === last ? 5 : 4}
              fill={point === last ? '#1e3a8a' : '#fff'}
              stroke="#2563eb"
              strokeWidth="2.5"
            />
          ) : null,
        )}
      </svg>

      <p className={styles.foot}>
        {real.length < 2 ? (
          <>فعلاً فقط یک هفته داده داریم؛ از هفته‌ی بعد روند معنا پیدا می‌کند.</>
        ) : (
          <>
            {change >= 0 ? 'رشد' : 'افت'}{' '}
            <b>{Math.abs(change).toLocaleString('fa-IR')} واحدی</b> نسبت به {first.label}
            {segments.some((segment) => segment.gap) && ' — هفته‌های بدونِ بازی خط‌چین‌اند.'}
          </>
        )}
      </p>
    </>
  );
}
