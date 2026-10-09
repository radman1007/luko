import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/Badge/Badge';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { DateFilter, FilterBar, SearchBox } from '../../components/Filters/Filters';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { ErrorState } from '../../components/States/States';
import { useTickets } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { TicketRow } from '../../types';
import { TICKET_TONE } from './tone';
import styles from '../Pages.module.css';

const TABS = [
  { value: '', label: 'همه' }, { value: 'open', label: 'باز' },
  { value: 'answered', label: 'پاسخ داده شده' }, { value: 'closed', label: 'بسته' },
];

const COLUMNS: Column<TicketRow>[] = [
  { key: 'subject', header: 'موضوع', render: (t) => <span className={styles.cell}><b>{t.subject}</b><small>#{faNum(t.id)}</small></span> },
  { key: 'user', header: 'فرستنده', render: (t) => <span className={styles.cell}><span>{t.userName}</span><small className={styles.ltr}>{t.userPhone}</small></span> },
  { key: 'status', header: 'وضعیت', render: (t) => <Badge tone={TICKET_TONE[t.status]} dot>{t.statusLabel}</Badge> },
  { key: 'messages', header: 'پیام', optional: true, render: (t) => faNum(t.messages ?? 0) },
  { key: 'last', header: 'آخرین پیام', render: (t) => t.lastAtFa },
];

export function TicketsPage() {
  const { values, set, reset, active } = useQueryState();
  const navigate = useNavigate();
  const { data, error, isFetching, refetch } = useTickets(values);
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader title="پشتیبانی" description="تیکت‌های والدین؛ پاسخِ شما در پنلِ والد با اعلان می‌رسد." />
      <div className={styles.tabs} role="group" aria-label="وضعیت">
        {TABS.map((t) => (
          <button key={t.value} type="button" aria-pressed={(values.status ?? '') === t.value} onClick={() => set({ status: t.value })}>
            {t.label}{t.value && counts[t.value] !== undefined ? ` (${faNum(counts[t.value])})` : ''}
          </button>
        ))}
      </div>
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="موضوع، متنِ پیام، نام یا شماره…" />
          <DateFilter label="از" value={values.from ?? ''} onChange={(from) => set({ from })} />
          <DateFilter label="تا" value={values.to ?? ''} onChange={(to) => set({ to })} />
        </FilterBar>
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="تیکت‌ها" columns={COLUMNS} rows={data?.results} rowKey={(t) => t.id} loading={isFetching}
            onRowClick={(t) => navigate(`/tickets/${t.id}`)} empty="تیکتی نیست." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
    </>
  );
}
