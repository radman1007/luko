import type { Point, Series } from './types';
import styles from './Charts.module.css';

interface LegendProps {
  series: Series[];
  shape: 'line' | 'rect';
}

/** راهنما برای ۲ سری یا بیشتر (یک سری راهنما نمی‌خواهد؛ عنوانِ کارت می‌گوید چیست) */
export function Legend({ series, shape }: LegendProps) {
  if (series.length < 2) return null;
  return (
    <ul className={styles.legend}>
      {series.map((s) => (
        <li key={s.key}>
          <span className={shape === 'line' ? styles.keyLine : styles.keyRect} style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

interface TipProps {
  point: Point;
  series: Series[];
  x: number;
  width: number;
  format: (v: number) => string;
}

/** یک برگه، همه‌ی سری‌ها؛ عدد پررنگ و نامِ سری کم‌رنگ */
export function Tooltip({ point, series, x, width, format }: TipProps) {
  const flip = x < 150;
  return (
    <div className={styles.tip} style={flip ? { left: x + 12 } : { left: Math.min(x, width) - 12, transform: 'translateX(-100%)' }}>
      <div className={styles.tipLabel}>{point.label}</div>
      {series.map((s) => (
        <div key={s.key} className={styles.tipRow}>
          <span className={styles.tipKey} style={{ background: s.color }} aria-hidden />
          <b>{format(point.values[s.key] ?? 0)}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

interface TableProps {
  points: Point[];
  series: Series[];
  title: string;
  format: (v: number) => string;
}

/** همان داده‌ها بی‌نمودار — برای صفحه‌خوان و هر کس عدد دقیق بخواهد */
export function DataTableView({ points, series, title, format }: TableProps) {
  return (
    <details className={styles.table}>
      <summary>جدولِ داده‌ها</summary>
      <table>
        <caption className="visually-hidden">{title}</caption>
        <thead>
          <tr>
            <th scope="col">زمان</th>
            {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              {series.map((s) => <td key={s.key}>{format(p.values[s.key] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
