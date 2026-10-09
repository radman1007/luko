import { useState } from 'react';
import { HiOutlinePlus } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { ConfirmDialog } from '../../components/Modal/Modal';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { ErrorState } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useMeta, usePodcasts } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { PodcastRow } from '../../types';
import { PodcastForm } from './PodcastForm';
import styles from '../Pages.module.css';

export function PodcastsPage() {
  const { values, set, reset, active } = useQueryState();
  const toast = useToast();
  const categories = (useMeta().data?.podcastCategories ?? []).map((c) => ({ value: c, label: c }));
  const { data, error, isFetching, refetch } = usePodcasts(values);
  const [editing, setEditing] = useState<PodcastRow | null | 'new'>(null);
  const [removing, setRemoving] = useState<PodcastRow | null>(null);
  const remove = useAction<object>('delete', () => `podcasts/${removing?.id}`, ['podcasts']);
  const toggle = useAction<{ id: number; isActive: boolean }>('patch', (b) => `podcasts/${b.id}`, ['podcasts']);

  const columns: Column<PodcastRow>[] = [
    { key: 'title', header: 'عنوان', render: (p) => <span className={styles.cell}><b>{p.title}</b><small>{p.fileName || p.audioUrl || '—'}</small></span> },
    { key: 'category', header: 'دسته', render: (p) => p.category },
    { key: 'audio', header: 'صدا', render: (p) => !p.hasAudio ? <Badge tone="red">بی‌صدا</Badge>
      : p.fileName ? <Badge tone="green">فایل</Badge> : <Badge tone="amber">پیوندِ بیرونی</Badge> },
    { key: 'duration', header: 'مدت', optional: true, render: (p) => p.durationMinutes ? `${faNum(p.durationMinutes)} دقیقه` : '—' },
    { key: 'listens', header: 'شنیده', optional: true, render: (p) => faNum(p.listens ?? 0) },
    { key: 'active', header: 'نمایش', render: (p) => (
      <Button size="sm" variant={p.isActive ? 'secondary' : 'ghost'} onClick={(e) => {
        e.stopPropagation();
        toggle.mutateAsync({ id: p.id, isActive: !p.isActive }).catch((err: unknown) => toast(messageOf(err), 'error'));
      }}>{p.isActive ? 'در سایت' : 'پنهان'}</Button>) },
    { key: 'actions', header: '', render: (p) => (
      <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setRemoving(p); }}>حذف</Button>) },
  ];

  return (
    <>
      <PageHeader title="پادکست‌ها" description="فقط قسمت‌هایی که صدا دارند و «در سایت» هستند به بچه‌ها نشان داده می‌شوند."
        actions={<Button variant="primary" icon={<HiOutlinePlus aria-hidden />} onClick={() => setEditing('new')}>پادکستِ تازه</Button>} />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="عنوان یا دسته…" />
          <SelectFilter label="دسته" value={values.category ?? ''} options={categories} onChange={(category) => set({ category })} />
          <SelectFilter label="نمایش" value={values.active ?? ''} onChange={(v) => set({ active: v })}
            options={[{ value: 'true', label: 'در سایت' }, { value: 'false', label: 'پنهان' }]} />
          <SelectFilter label="صدا" value={values.audio ?? ''} onChange={(audio) => set({ audio })}
            options={[{ value: 'ok', label: 'دارد' }, { value: 'missing', label: 'ندارد' }]} />
        </FilterBar>
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="پادکست‌ها" columns={columns} rows={data?.results} rowKey={(p) => p.id} loading={isFetching}
            onRowClick={(p) => setEditing(p)} empty="پادکستی نیست؛ اولی را اضافه کنید." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
      {editing && <PodcastForm key={editing === 'new' ? 'new' : editing.id} open podcast={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)} />}
      <ConfirmDialog open={Boolean(removing)} title="حذفِ پادکست" danger confirmLabel="حذف شود" busy={remove.isPending}
        message={`«${removing?.title}» و فایلش برای همیشه پاک می‌شود.`} onClose={() => setRemoving(null)}
        onConfirm={() => void remove.mutateAsync({}).then(() => { toast('حذف شد.'); setRemoving(null); })
          .catch((e: unknown) => toast(messageOf(e), 'error'))} />
    </>
  );
}
