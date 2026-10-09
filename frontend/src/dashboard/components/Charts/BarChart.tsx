import { useState } from 'react';
import { faNum } from '../../lib/format';
import { labelEvery, niceScale } from './chartMath';
import { DataTableView, Legend, Tooltip } from './ChartParts';
import type { ChartProps } from './types';
import { useWidth } from './useWidth';
import styles from './Charts.module.css';

const PAD = { top: 12, right: 44, bottom: 28, left: 8 };
const GAP = 2;

/** ستون‌ها (روی هم برای ۲ سری)؛ هر ستون خودش هدفِ اشاره است */
export function BarChart({ points, series, height = 220, format = faNum, title }: ChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = points.map((p) => series.reduce((sum, s) => sum + (p.values[s.key] ?? 0), 0));
  const { top, ticks } = niceScale(Math.max(0, ...totals));
  const left = PAD.left;
  const right = Math.max(left + 1, width - PAD.right);
  const bottom = height - PAD.bottom;
  const slot = (right - left) / Math.max(1, points.length);
  const bar = Math.max(3, Math.min(24, slot * 0.62));
  const y = (v: number) => bottom - ((bottom - PAD.top) * v) / top;
  // راست‌به‌چپ: اولین نقطه سمتِ راست
  const cx = (i: number) => right - slot * (i + 0.5);
  const every = labelEvery(points.length, (right - left) / 52);

  return (
    <figure className={styles.figure}>
      <Legend series={series} shape="rect" />
      <div ref={ref} className={styles.plot} style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={right} y1={y(t)} y2={y(t)} className={styles.grid} />
                <text x={width - 6} y={y(t) + 4} className={styles.axis} textAnchor="end">{format(t)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              let base = bottom;
              const visible = series.filter((s) => (p.values[s.key] ?? 0) > 0);
              return (
                <g key={p.label} opacity={hover === null || hover === i ? 1 : 0.55}>
                  {visible.map((s, k) => {
                    const h = Math.max(0, bottom - y(p.values[s.key] ?? 0) - (k > 0 ? GAP : 0));
                    base -= h + (k > 0 ? GAP : 0);
                    const isTop = k === visible.length - 1;
                    const r = isTop ? Math.min(4, h / 2, bar / 2) : 0;
                    const x0 = cx(i) - bar / 2;
                    return (
                      <path key={s.key} fill={s.color}
                        d={`M${x0},${base + h} L${x0},${base + r} Q${x0},${base} ${x0 + r},${base} L${x0 + bar - r},${base} Q${x0 + bar},${base} ${x0 + bar},${base + r} L${x0 + bar},${base + h} Z`} />
                    );
                  })}
                  {(i % every === 0) && (
                    <text x={cx(i)} y={height - 8} className={styles.axis} textAnchor="middle">{p.label}</text>
                  )}
                  <rect x={cx(i) - slot / 2} y={PAD.top} width={slot} height={bottom - PAD.top} fill="transparent"
                    tabIndex={0} aria-label={`${p.label}: ${series.map((s) => `${s.label} ${format(p.values[s.key] ?? 0)}`).join('، ')}`}
                    onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && points[hover] && (
          <Tooltip point={points[hover]} series={series} x={cx(hover)} width={width} format={format} />
        )}
      </div>
      <DataTableView points={points} series={series} title={title} format={format} />
    </figure>
  );
}
