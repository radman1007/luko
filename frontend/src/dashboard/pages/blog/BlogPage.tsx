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
import { useBlog } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { BlogRow } from '../../types';
import styles from '../Pages.module.css';

const COLUMNS: Column<BlogRow>[] = [
  { key: 'title', header: 'عنوان', render: (p) => <span className={styles.cell}><b>{p.title}</b><small>{p.summary || '—'}</small></span> },
  { key: 'status', header: 'وضعیت', render: (p) => p.status === 'published'
    ? <Badge tone={p.isLive ? 'green' : 'amber'} dot>{p.isLive ? 'منتشرشده' : 'زمان‌بندی‌شده'}</Badge>
    : <Badge tone="gray">پیش‌نویس</Badge> },
  { key: 'category', header: 'دسته', optional: true, render: (p) => p.category || '—' },
  { key: 'author', header: 'نویسنده', optional: true, render: (p) => p.author || '—' },
  { key: 'read', header: 'خواندن', optional: true, render: (p) => `${faNum(p.readingMinutes)} دقیقه` },
  { key: 'updated', header: 'آخرین تغییر', render: (p) => p.updatedFa },
];

export function BlogPage() {
  const { values, set, reset, active } = useQueryState();
  const navigate = useNavigate();
  const { data, error, isFetching, refetch } = useBlog(values);
  const categories = (data?.categories ?? []).map((c) => ({ value: c, label: c }));

  return (
    <>
      <PageHeader title="وبلاگ" description="پست‌های منتشرشده روی سایتِ لندینگ (luko.ir) نشان داده می‌شوند."
        actions={<Button variant="primary" icon={<HiOutlinePlus aria-hidden />} onClick={() => navigate('/blog/new')}>پستِ تازه</Button>} />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="عنوان، متن یا برچسب…" />
          <SelectFilter label="وضعیت" value={values.status ?? ''} onChange={(status) => set({ status })}
            options={[{ value: 'published', label: 'منتشرشده' }, { value: 'draft', label: 'پیش‌نویس' }]} />
          <SelectFilter label="دسته" value={values.category ?? ''} options={categories} onChange={(category) => set({ category })} />
        </FilterBar>
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="پست‌ها" columns={COLUMNS} rows={data?.results} rowKey={(p) => p.id} loading={isFetching}
            onRowClick={(p) => navigate(`/blog/${p.id}`)} empty="هنوز پستی نیست." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
    </>
  );
}
