import { DataTable } from '../components/DataTable/DataTable';
import type { Column } from '../components/DataTable/DataTable';
import { DateFilter, FilterBar, SearchBox, SelectFilter } from '../components/Filters/Filters';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Pagination } from '../components/Pagination/Pagination';
import { ErrorState } from '../components/States/States';
import { useAudit, useMeta } from '../features/data/hooks';
import { messageOf } from '../lib/api';
import { useQueryState } from '../lib/useQueryState';
import type { AuditRow } from '../types';
import styles from './Pages.module.css';

function details(row: AuditRow): string {
  return Object.entries(row.details ?? {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ← ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

const COLUMNS: Column<AuditRow>[] = [
  { key: 'at', header: 'زمان', width: '170px', render: (a) => a.at },
  { key: 'actor', header: 'انجام‌دهنده', render: (a) => a.actor },
  { key: 'action', header: 'کار', render: (a) => <b>{a.actionLabel}</b> },
  { key: 'target', header: 'روی', render: (a) => <span className={styles.cell}><span>{a.target || '—'}</span><small>{details(a)}</small></span> },
  { key: 'ip', header: 'IP', optional: true, render: (a) => <span className={styles.ltr}>{a.ip}</span> },
];

export function AuditPage() {
  const { values, set, reset, active } = useQueryState();
  const actions = useMeta().data?.auditActions ?? [];
  const { data, error, isFetching, refetch } = useAudit(values);
  return (
    <>
      <PageHeader title="گزارشِ فعالیت" description="هر ورود و هر تغییر در داشبورد این‌جا ثبت می‌شود و پاک‌شدنی نیست." />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="نام، هدف یا IP…" />
          <SelectFilter label="کار" value={values.action ?? ''} options={actions} onChange={(action) => set({ action })} />
          <DateFilter label="از" value={values.from ?? ''} onChange={(from) => set({ from })} />
          <DateFilter label="تا" value={values.to ?? ''} onChange={(to) => set({ to })} />
        </FilterBar>
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="گزارشِ فعالیت" columns={COLUMNS} rows={data?.results} rowKey={(a) => a.id} loading={isFetching}
            empty="فعالیتی ثبت نشده." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
    </>
  );
}
