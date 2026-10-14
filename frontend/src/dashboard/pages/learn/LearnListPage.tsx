import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { ErrorState } from '../../components/States/States';
import { useLearnItems } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { LearnRow } from '../../types';
import styles from '../Pages.module.css';
import { KINDS, TOPICS } from './options';

const COLUMNS: Column<LearnRow>[] = [
  { key: 'title', header: 'عنوان', render: (r) => (
    <span className={styles.cell}><b>{r.title}</b><small>{r.kindLabel} · {r.topicLabel}{r.featured ? ' · برگزیده' : ''}</small></span>
  ) },
  { key: 'status', header: 'وضعیت', render: (r) => r.status === 'published'
    ? <Badge tone={r.isLive ? 'green' : 'amber'} dot>{r.isLive ? 'منتشرشده' : 'زمان‌بندی‌شده'}</Badge>
    : <Badge tone="gray">پیش‌نویس</Badge> },
  { key: 'access', header: 'دسترسی', render: (r) => (r.premium ? <Badge tone="amber">ویژه‌ی مشترکان</Badge> : <Badge>رایگان</Badge>) },
  { key: 'media', header: 'فایل', optional: true, render: (r) => (r.kind === 'article' ? '—'
    : r.hasMedia ? <Badge tone="teal">دارد</Badge> : <Badge tone="red">ندارد</Badge>) },
  { key: 'views', header: 'بازدید', optional: true, render: (r) => `${faNum(r.views)}${r.saved ? `، ${faNum(r.saved)} ذخیره` : ''}` },
  { key: 'updated', header: 'آخرین تغییر', render: (r) => r.updatedFa },
];

export function LearnListPage() {
  const { values, set, reset, active } = useQueryState();
  const navigate = useNavigate();
  const { data, error, isFetching, refetch } = useLearnItems(values);
  return (
    <>
      <PageHeader title="آموزشِ والدین"
        description="مقاله، ویدیو و پادکستِ صفحه‌ی «آموزش» در پنلِ والدین. «ویژه» برای والدِ بی‌اشتراک فقط پیش‌نمایش دارد."
        actions={<Button variant="primary" icon={<HiOutlinePlus aria-hidden />} onClick={() => navigate('/learn/new')}>محتوای تازه</Button>} />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="عنوان، خلاصه یا متن…" />
          <SelectFilter label="نوع" value={values.kind ?? ''} options={KINDS} onChange={(kind) => set({ kind })} />
          <SelectFilter label="موضوع" value={values.topic ?? ''} options={TOPICS} onChange={(topic) => set({ topic })} />
          <SelectFilter label="وضعیت" value={values.status ?? ''} onChange={(status) => set({ status })}
            options={[{ value: 'published', label: 'منتشرشده' }, { value: 'draft', label: 'پیش‌نویس' }]} />
        </FilterBar>
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="محتواها" columns={COLUMNS} rows={data?.results} rowKey={(r) => r.id} loading={isFetching}
            onRowClick={(r) => navigate(`/learn/${r.id}`)} empty="هنوز محتوایی نیست." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
    </>
  );
}
