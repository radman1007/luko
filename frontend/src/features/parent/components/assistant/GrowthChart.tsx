import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { GrowthDim } from '../../types';
import { DIM_LOOK, fa } from './look';
import styles from './GrowthChart.module.css';

interface Props {
  weeks: { label: string; range: string }[];
  /** فقط بُعدهای باز و دارای داده */
  dims: GrowthDim[];
}

const H = 210;
const TOP = 14;
const BOTTOM = 30;
/** راست: برچسبِ محورِ عمودی (RTL)؛ چپ: برچسبِ مستقیمِ آخرین مقدار */
const RIGHT = 38;
const LEFT = 46;
const LABEL_GAP = 14;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setWidth(node.clientWidth || 320);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || 320));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * نمودارِ رشدِ چهار هفته: یک خط برای هر بُعد، قدیمی‌ترین هفته سمتِ راست. هفته‌ی بی‌داده (null) صفر نیست:
 * نقطه‌اش کشیده نمی‌شود و خط از رویش خط‌چین رد می‌شود. خطِ عمودی با اشاره یا کلیدهای جهت روی نزدیک‌ترین هفته
 * می‌نشیند و همه‌ی بُعدها را در یک برچسب نشان می‌دهد؛ همان عددها در «جدول» هم هست.
 */
export function GrowthChart({ weeks, dims }: Props) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const count = weeks.length;
  const plotW = Math.max(120, width - LEFT - RIGHT);
  const step = count > 1 ? plotW / (count - 1) : 0;
  const x = (i: number) => width - RIGHT - i * step;
  const y = (value: number) => TOP + (1 - value / 100) * (H - TOP - BOTTOM);

  useEffect(() => setActive(null), [dims.length]);

  // برچسبِ مستقیم کنارِ آخرین نقطه‌ی هر خط؛ برچسب‌های نزدیک از هم باز می‌شوند
  const ends = dims
    .map((dim) => {
      let index = -1;
      dim.points.forEach((point, i) => { if (point !== null) index = i; });
      return index < 0 ? null : { dim, index, value: dim.points[index] as number, ly: y(dim.points[index] as number) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i += 1) {
    if (ends[i].ly - ends[i - 1].ly < LABEL_GAP) ends[i].ly = ends[i - 1].ly + LABEL_GAP;
  }

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const index = step ? Math.round((width - RIGHT - px) / step) : 0;
    setActive(Math.min(count - 1, Math.max(0, index)));
  };

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    // RTL: چپ یعنی هفته‌ی تازه‌تر
    if (event.key === 'ArrowLeft') setActive((v) => Math.min(count - 1, (v ?? -1) + 1));
    else if (event.key === 'ArrowRight') setActive((v) => Math.max(0, (v ?? count) - 1));
    else if (event.key === 'Escape') setActive(null);
    else return;
    event.preventDefault();
  };

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 90), width - 90);

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.plot}>
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className={styles.svg} role="img" tabIndex={0}
          aria-label={`نمودارِ رشد در ${fa(count)} هفته: ${dims.map((d) => `${d.label} ${d.now === null ? 'بی‌داده' : `${fa(d.now)}٪`}`).join('، ')}. با کلیدهای جهت هفته‌ها را ببینید.`}
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={(event) => { if (event.pointerType === 'mouse') setActive(null); }}
          onKeyDown={onKey} onBlur={() => setActive(null)}>
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line x1={LEFT - 6} x2={width - RIGHT + 6} y1={y(value)} y2={y(value)} className={styles.grid} />
              <text x={width - 4} y={y(value) + 3.5} textAnchor="end" className={styles.axis}>{fa(value)}٪</text>
            </g>
          ))}
          {weeks.map((week, i) => (
            <text key={week.label} x={x(i)} y={H - 8} textAnchor="middle" className={styles.axis}
              data-active={active === i || undefined}>{week.label}</text>
          ))}

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={TOP - 6} y2={H - BOTTOM + 4} className={styles.crosshair} />
          )}

          {dims.map((dim) => {
            const color = DIM_LOOK[dim.key].color;
            const known = dim.points.map((p, i) => ({ p, i })).filter((item): item is { p: number; i: number } => item.p !== null);
            const segments = known.slice(1).map((item, k) => ({
              d: `M ${x(known[k].i)} ${y(known[k].p)} L ${x(item.i)} ${y(item.p)}`,
              gap: item.i - known[k].i > 1,
            }));
            return (
              <g key={dim.key}>
                {segments.map((seg) => (
                  <path key={seg.d} d={seg.d} stroke={color} className={styles.line} data-gap={seg.gap || undefined} />
                ))}
                {known.map(({ p, i }) => (
                  <circle key={i} cx={x(i)} cy={y(p)} r={active === i ? 5.5 : 4} fill={color} className={styles.dot} />
                ))}
              </g>
            );
          })}

          {active === null && ends.map(({ dim, index, value, ly }) => (
            <g key={dim.key}>
              <line x1={x(index) - 6} x2={x(index) - 12} y1={y(value)} y2={ly} stroke={DIM_LOOK[dim.key].color} className={styles.leader} />
              <text x={x(index) - 14} y={ly + 3.5} textAnchor="end" className={styles.end}>{fa(value)}٪</text>
            </g>
          ))}
        </svg>

        {active !== null && (
          <div className={styles.tip} style={{ left: tipLeft }} role="status">
            <b>{weeks[active].label}</b>
            <small>{weeks[active].range}</small>
            <ul>
              {dims.map((dim) => (
                <li key={dim.key}>
                  <i style={{ background: DIM_LOOK[dim.key].color }} aria-hidden />
                  <strong>{dim.points[active] === null ? '—' : `${fa(dim.points[active] as number)}٪`}</strong>
                  <span>{dim.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button type="button" className={styles.tableBtn} aria-expanded={table} onClick={() => setTable(!table)}>
        {table ? 'بستنِ جدول' : 'دیدنِ عددها در جدول'}
      </button>
      {table && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">بُعد</th>
                {weeks.map((week) => <th key={week.label} scope="col" title={week.range}>{week.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {dims.map((dim) => (
                <tr key={dim.key}>
                  <th scope="row">{dim.label}</th>
                  {dim.points.map((point, i) => <td key={i}>{point === null ? '—' : `${fa(point)}٪`}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p>«—» یعنی آن هفته داده‌ی کافی نبود (کمتر از سه بازی یا دو ثبتِ حال).</p>
        </div>
      )}
    </div>
  );
}
