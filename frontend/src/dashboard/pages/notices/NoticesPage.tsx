import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/Badge/Badge';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { useNotices } from '../../features/data/hooks';
import { faNum } from '../../lib/format';
import type { NoticeRow } from '../../types';
import { Compose } from './Compose';
import styles from '../Pages.module.css';

const COLUMNS: Column<NoticeRow>[] = [
  { key: 'title', header: 'اعلان', render: (n) => <span className={styles.cell}><b>{n.title}</b><small>{n.body || '—'}</small></span> },
  { key: 'aud', header: 'گیرندگان', render: (n) => <span className={styles.cell}>
    <Badge tone={n.audience === 'parents' ? 'blue' : 'teal'}>{n.audienceLabel}</Badge><small>{n.filtersLabel}</small></span> },
  { key: 'reach', header: 'خوانده', render: (n) => `${faNum(n.read)} از ${faNum(n.recipients)}${n.recipients
    ? ` (${faNum(Math.round((n.read / n.recipients) * 100))}٪)` : ''}` },
  { key: 'by', header: 'فرستنده', optional: true, render: (n) => n.sentBy || '—' },
  { key: 'at', header: 'زمان', render: (n) => n.at },
];

function parseFilters(raw: string | null): Record<string, string> {
  try {
    const value = JSON.parse(raw || '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, String(v)]));
  } catch {
    return {};
  }
}

export function NoticesPage() {
  const [params] = useSearchParams();
  const fromLink = params.get('audience');
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [hist, setHist] = useState({ q: '', audience: '', page: '1' });
  const { data, isFetching } = useNotices(hist);

  return (
    <>
      <PageHeader title="ارسالِ اعلان" description="پیام به پنلِ والدین یا صندوقِ پیام‌های بچه‌ها، با فیلترِ دقیق" />
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-pressed={tab === 'compose'} aria-selected={tab === 'compose'} onClick={() => setTab('compose')}>اعلانِ تازه</button>
        <button type="button" role="tab" aria-pressed={tab === 'history'} aria-selected={tab === 'history'} onClick={() => setTab('history')}>تاریخچه</button>
      </div>
      {tab === 'compose' ? (
        <Compose initialAudience={fromLink === 'parents' || fromLink === 'students' ? fromLink : ''}
          initialFilters={parseFilters(params.get('filters'))} onSent={() => setTab('history')} />
      ) : (
        <div className={styles.tableCard}>
          <FilterBar>
            <SearchBox value={hist.q} onChange={(q) => setHist({ ...hist, q, page: '1' })} placeholder="عنوان یا متن…" />
            <SelectFilter label="گیرندگان" value={hist.audience} onChange={(audience) => setHist({ ...hist, audience, page: '1' })}
              options={[{ value: 'parents', label: 'والدین' }, { value: 'students', label: 'دانش‌آموزان' }]} />
          </FilterBar>
          <DataTable caption="اعلان‌های فرستاده‌شده" columns={COLUMNS} rows={data?.results} rowKey={(n) => n.id}
            loading={isFetching} empty="هنوز اعلانی فرستاده نشده." />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => setHist({ ...hist, page: String(page) })} />}
        </div>
      )}
    </>
  );
}
