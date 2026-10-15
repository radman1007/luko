import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp, HiOutlineSparkles } from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import type { AiStatus, Growth, GrowthDim } from '../../types';
import { AiBadge } from '../ai/AiBadge';
import { DIM_LOOK, fa } from './look';
import styles from './MonthReport.module.css';

interface Props {
  growth?: Growth;
  ai?: AiStatus;
  childName: string;
  canAsk: boolean;
  onAsk: () => void;
  onUpgrade: () => void;
  onGoDaily: () => void;
}

/**
 * گزارشِ ماهانه: همان چهار بُعدِ نمودارِ دستیار، هر کدام با «چطور حساب می‌شود»، عددِ هر هفته و جزئیات.
 * بُعدِ قفل (بی‌اشتراک) فقط نام و دعوت به اشتراک دارد؛ داده‌اش از سرور نمی‌آید.
 */
export function MonthReport({ growth, ai, childName, canAsk, onAsk, onUpgrade, onGoDaily }: Props) {
  if (!growth) {
    return <p className={styles.empty}>گزارشِ این ماه در حالِ آماده شدن است؛ چند لحظه‌ی دیگر دوباره سر بزنید.</p>;
  }
  const dims = growth.dims.filter((dim) => dim.status !== 'none');
  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <section className={styles.summary}>
          <header>
            <span className={styles.spark} aria-hidden><HiOutlineSparkles /></span>
            <h3>خلاصه‌ی چهار هفته</h3>
            <AiBadge ai={ai} written={growth.source === 'ai'} />
          </header>
          <p>{growth.summary}</p>
          <ul className={styles.weeks} aria-label="بازه‌ی هر هفته">
            {growth.weeks.map((week) => <li key={week.label}><b>{week.label}</b> {week.range}</li>)}
          </ul>
          {growth.active ? (
            <button type="button" className={styles.ask} disabled={!canAsk} onClick={onAsk}>
              <HiOutlineSparkles aria-hidden /> توضیحِ این گزارش را از دستیار بپرسید
            </button>
          ) : (
            <button type="button" className={styles.ask} onClick={onGoDaily}>انتخابِ بازیِ امروزِ {childName}</button>
          )}
        </section>

        <div className={styles.grid}>
          {dims.map((dim) => (
            <DimCard key={dim.key} dim={dim} weeks={growth.weeks} onUpgrade={onUpgrade} />
          ))}
        </div>
      </div>
    </div>
  );
}

function facts(dim: GrowthDim): [string, string][] {
  const d = dim.detail;
  if (dim.kind === 'progress') {
    const out: [string, string][] = [
      ['بازی‌های تمام‌شده', `${fa(d.done ?? 0)} از ${fa(d.total ?? 0)}`],
      ['تازه در این چهار هفته', fa(d.newThisMonth ?? 0)],
    ];
    if (d.accuracy !== null && d.accuracy !== undefined) {
      out.push(['دقتِ پاسخ‌ها', `${fa(d.accuracy)}٪ از ${fa(d.answers ?? 0)} پاسخ`]);
    }
    return out;
  }
  if (dim.key === 'focus') {
    return [
      ['تا آخر رفته', `${fa(d.finished ?? 0)} بازی`],
      ['نیمه‌کاره مانده', `${fa(d.abandoned ?? 0)} بازی`],
      ['زمانِ فعال', `${fa(d.activeMinutes ?? 0)} دقیقه`],
      ['بی‌حرکت', `${fa(d.idleMinutes ?? 0)} دقیقه`],
    ];
  }
  const checkins = (d.checkins ?? []).reduce((sum, n) => sum + n, 0);
  return [
    ['ثبت‌های حال', fa(checkins)],
    ['حالِ خوب در کلِ ماه', d.good === null || d.good === undefined ? '—' : `${fa(d.good)}٪`],
  ];
}

function DimCard({ dim, weeks, onUpgrade }: { dim: GrowthDim; weeks: Growth['weeks']; onUpgrade: () => void }) {
  const look = DIM_LOOK[dim.key];
  const Icon = look.icon;
  const head = (
    <header className={styles.head}>
      <span className={styles.icon} style={{ background: look.soft, color: look.color }} aria-hidden><Icon /></span>
      <div>
        <h3>{dim.label}</h3>
        <p>{dim.how}</p>
      </div>
    </header>
  );
  if (dim.locked) {
    return (
      <section className={styles.card} data-locked>
        {head}
        <div className={styles.lock}>
          <CrownIcon size={22} strokeWidth={2} aria-hidden />
          <p>روندِ هفته‌به‌هفته‌ی {dim.label} با اشتراک باز می‌شود.</p>
          <button type="button" onClick={onUpgrade}>دیدنِ اشتراک</button>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.card}>
      {head}
      <div className={styles.now}>
        {dim.now === null ? (
          <em>{dim.status === 'empty' && dim.kind === 'progress' ? 'هنوز شروع نشده' : 'داده‌ی کافی نیست'}</em>
        ) : (
          <>
            <b>{fa(dim.now)}٪</b>
            <small>{dim.kind === 'progress' ? 'پیشرفت تا امروز' : 'هفته‌ی آخر'}</small>
            {dim.change !== null && dim.change !== 0 && (
              <span data-dir={dim.change > 0 ? 'up' : 'down'}>
                {dim.change > 0 ? <HiOutlineArrowTrendingUp aria-hidden /> : <HiOutlineArrowTrendingDown aria-hidden />}
                {fa(Math.abs(dim.change))} {dim.change > 0 ? 'بیشتر' : 'کمتر'} از اولین هفته
              </span>
            )}
          </>
        )}
      </div>
      <ol className={styles.bars} aria-label={`${dim.label} در هر هفته`}>
        {dim.points.map((point, i) => (
          <li key={weeks[i].label} title={weeks[i].range}>
            <span className={styles.value}>{point === null ? '—' : `${fa(point)}٪`}</span>
            <span className={styles.track} aria-hidden>
              {point !== null && (
                <i style={{ height: `${Math.max(point, 3)}%`, background: look.color }} />
              )}
            </span>
            <span className={styles.week}>{weeks[i].label}</span>
          </li>
        ))}
      </ol>
      <dl className={styles.facts}>
        {facts(dim).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
