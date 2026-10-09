import { HiOutlineBolt, HiOutlineClock, HiOutlineSignal, HiOutlineUserGroup } from 'react-icons/hi2';
import { Card } from '../components/Card/Card';
import { BarChart } from '../components/Charts/BarChart';
import { LineChart } from '../components/Charts/LineChart';
import { FilterBar, SelectFilter } from '../components/Filters/Filters';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { StatCard } from '../components/StatCard/StatCard';
import { ErrorState, Loading } from '../components/States/States';
import { useAnalytics, useOnline } from '../features/data/hooks';
import { messageOf } from '../lib/api';
import { faNum, minutes } from '../lib/format';
import { useQueryState } from '../lib/useQueryState';
import type { Totals } from '../types';
import styles from './Pages.module.css';

const RANGES = [
  { value: '24h', label: '۲۴ ساعت' },
  { value: '7d', label: '۷ روز' },
  { value: '30d', label: '۳۰ روز' },
  { value: '90d', label: '۹۰ روز' },
];
const PLATFORMS = [{ value: 'web', label: 'وب' }, { value: 'android', label: 'اپِ اندروید' }];
const AUDIENCES = [{ value: 'student', label: 'دانش‌آموز' }, { value: 'parent', label: 'والد' }, { value: 'guest', label: 'مهمان' }];
const ALL_SERIES = [
  { key: 'web', label: 'وب', color: 'var(--chart-1)' },
  { key: 'android', label: 'اپِ اندروید', color: 'var(--chart-2)' },
];

function Breakdown({ rows }: { rows: { label: string; t: Totals }[] }) {
  return (
    <ul className={styles.list}>
      {rows.map(({ label, t }) => (
        <li key={label}>
          <span className={styles.cell}><b>{label}</b><small>میانگینِ {minutes(t.avgMinutes)} در هر روزِ حضور</small></span>
          <b>{faNum(t.visitors)} نفر</b>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsPage() {
  const { values, set } = useQueryState();
  const range = values.range ?? '7d';
  const { data, error, refetch, isLoading } = useAnalytics({ range, platform: values.platform ?? '', audience: values.audience ?? '' });
  const online = useOnline().data ?? data?.online;
  const series = values.platform ? ALL_SERIES.filter((s) => s.key === values.platform) : ALL_SERIES;

  return (
    <>
      <PageHeader title="آمار و بازدید"
        description="بازدیدکننده = هر کاربرِ واردشده یا دستگاهِ مهمان؛ اپِ اندروید فقط وقتی اینترنت دارد شمرده می‌شود." />
      <div className={styles.tabs} role="group" aria-label="بازه">
        {RANGES.map((r) => (
          <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => set({ range: r.value })}>{r.label}</button>
        ))}
      </div>
      <div className={styles.tableCard} style={{ marginBottom: 16 }}>
        <FilterBar>
          <SelectFilter label="سکو" value={values.platform ?? ''} options={PLATFORMS} onChange={(v) => set({ platform: v })} />
          <SelectFilter label="گروه" value={values.audience ?? ''} options={AUDIENCES} onChange={(v) => set({ audience: v })} />
        </FilterBar>
      </div>
      {isLoading && <Loading />}
      {!isLoading && !data && <ErrorState message={messageOf(error)} onRetry={() => void refetch()} />}
      {data && (
        <>
          <div className={styles.stats}>
            <StatCard live label="همین حالا آنلاین" value={faNum(online?.total ?? 0)} icon={<HiOutlineSignal />}
              hint={`کاربر ${faNum(online?.users ?? 0)} · مهمان ${faNum(online?.guests ?? 0)}`} />
            <StatCard label="بازدیدکننده‌ی یکتا" value={faNum(data.totals.visitors)} icon={<HiOutlineUserGroup />} tone="violet"
              hint={RANGES.find((r) => r.value === range)?.label} />
            <StatCard label="میانگینِ ماندن" value={minutes(data.totals.avgMinutes)} icon={<HiOutlineClock />} tone="orange"
              hint="برای هر نفر در هر روزی که آمده" />
            <StatCard label="کلِ زمانِ ماندن" value={minutes(data.totals.minutes)} icon={<HiOutlineBolt />} tone="green" />
          </div>
          <div className={styles.grid2}>
            <Card title="بازدیدکننده‌ها در طولِ زمان" description={range === '24h' ? 'هر ساعت' : 'هر روز'}>
              <LineChart title="بازدیدکننده‌ها در طولِ زمان" series={series}
                points={data.series.map((p) => ({ label: p.label, values: { web: p.web, android: p.android } }))} />
            </Card>
            <Card title="میانگینِ دقیقه برای هر بازدیدکننده">
              <BarChart title="میانگینِ دقیقه" format={(v) => faNum(Math.round(v * 10) / 10)}
                series={[{ key: 'avg', label: 'میانگینِ دقیقه', color: 'var(--chart-1)' }]}
                points={data.series.map((p) => ({ label: p.label, values: { avg: p.avgMinutes } }))} />
            </Card>
          </div>
          <div className={styles.grid3}>
            <Card title="وب در برابرِ اپ">
              <Breakdown rows={[{ label: 'وب', t: data.byPlatform.web }, { label: 'اپِ اندروید', t: data.byPlatform.android }]} />
            </Card>
            <Card title="به تفکیکِ گروه">
              <Breakdown rows={[{ label: 'دانش‌آموزان', t: data.byAudience.student },
                { label: 'والدین', t: data.byAudience.parent }, { label: 'مهمان‌ها', t: data.byAudience.guest }]} />
            </Card>
            <Card title="ساعت‌های شلوغِ روز" description="میانگینِ بازدیدکننده در هر ساعت (وقتِ تهران)">
              <BarChart title="ساعت‌های شلوغ" height={180} format={(v) => faNum(Math.round(v * 10) / 10)}
                series={[{ key: 'v', label: 'بازدیدکننده', color: 'var(--chart-1)' }]}
                points={data.hoursOfDay.map((h) => ({ label: h.label, values: { v: h.visitors } }))} />
            </Card>
          </div>
          {data.signups.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Card title="ثبت‌نامِ تازه در همین بازه">
                <BarChart title="ثبت‌نامِ تازه" series={[{ key: 'students', label: 'دانش‌آموز', color: 'var(--chart-1)' },
                  { key: 'parents', label: 'والد', color: 'var(--chart-2)' }]}
                  points={data.signups.map((p) => ({ label: p.label, values: { students: p.students, parents: p.parents } }))} />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
