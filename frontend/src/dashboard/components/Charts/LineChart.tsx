import { useState } from 'react';
import { faNum } from '../../lib/format';
import { labelEvery, niceScale, xAt } from './chartMath';
import { DataTableView, Legend, Tooltip } from './ChartParts';
import type { ChartProps } from './types';
import { useWidth } from './useWidth';
import styles from './Charts.module.css';

const PAD = { top: 12, right: 44, bottom: 28, left: 12 };

/** روند در طولِ زمان؛ زمان از راست به چپ، خطِ عمودیِ راهنما با برگه‌ی همه‌ی سری‌ها */
export function LineChart({ points, series, height = 240, format = faNum, title }: ChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const { top, ticks } = niceScale(max);
  const left = PAD.left;
  const right = Math.max(left + 1, width - PAD.right);
  const bottom = height - PAD.bottom;
  const y = (v: number) => bottom - ((bottom - PAD.top) * v) / top;
  const x = (i: number) => xAt(i, points.length, left, right);
  const every = labelEvery(points.length, (right - left) / 56);

  const pick = (clientX: number, rect: DOMRect) => {
    if (points.length === 0) return;
    const ratio = (right - (clientX - rect.left)) / Math.max(1, right - left);
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <figure className={styles.figure}>
      <Legend series={series} shape="line" />
      <div ref={ref} className={styles.plot} style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={right} y1={y(t)} y2={y(t)} className={styles.grid} />
                <text x={width - 6} y={y(t) + 4} className={styles.axis} textAnchor="end">{format(t)}</text>
              </g>
            ))}
            {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
              <text key={p.label} x={x(i)} y={height - 8} className={styles.axis} textAnchor="middle">{p.label}</text>
            ))}
            {series.length === 1 && points.length > 1 && (
              <path
                d={`M${x(0)},${bottom} ${points.map((p, i) => `L${x(i)},${y(p.values[series[0].key] ?? 0)}`).join(' ')} L${x(points.length - 1)},${bottom} Z`}
                fill={series[0].color} opacity={0.1}
              />
            )}
            {series.map((s) => (
              <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                points={points.map((p, i) => `${x(i)},${y(p.values[s.key] ?? 0)}`).join(' ')} />
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={bottom} className={styles.cross} />}
            {series.map((s) => {
              const i = hover ?? points.length - 1;
              if (i < 0) return null;
              return <circle key={s.key} cx={x(i)} cy={y(points[i]?.values[s.key] ?? 0)} r={4.5} fill={s.color}
                stroke="#fff" strokeWidth={2} />;
            })}
            <rect x={left} y={0} width={right - left} height={bottom} fill="transparent" tabIndex={0}
              aria-label={`${title} — با کلیدهای جهت جابه‌جا شوید`}
              onPointerMove={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onPointerLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                const last = points.length - 1;
                const cur = hover ?? last;
                if (e.key === 'ArrowLeft') setHover(Math.min(last, cur + 1));
                if (e.key === 'ArrowRight') setHover(Math.max(0, cur - 1));
              }} />
          </svg>
        )}
        {hover !== null && points[hover] && (
          <Tooltip point={points[hover]} series={series} x={x(hover)} width={width} format={format} />
        )}
      </div>
      <DataTableView points={points} series={series} title={title} format={format} />
    </figure>
  );
}
