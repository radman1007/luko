import { useState } from 'react';
import { HiOutlinePlus } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { ConfirmDialog } from '../../components/Modal/Modal';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { ErrorState } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useConcepts, useMeta, useUnknownConcepts } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { ConceptRow, UnknownConcept } from '../../types';
import { ConceptForm } from './ConceptForm';
import styles from '../Pages.module.css';

type Editing = { concept: ConceptRow | null; code?: string } | null;

/** کدهایی که بازی‌ها فرستاده‌اند ولی ثبت نشده‌اند — معمولاً غلطِ املایی یا تگِ تازه */
function UnknownCodes({ onRegister }: { onRegister: (code: string) => void }) {
  const { data } = useUnknownConcepts();
  const rows = data?.results ?? [];
  if (rows.length === 0) return null;
  const columns: Column<UnknownConcept>[] = [
    { key: 'code', header: 'کد', render: (u) => <b className={styles.ltr}>{u.code}</b> },
    { key: 'count', header: 'رویداد', render: (u) => faNum(u.count) },
    { key: 'game', header: 'مثلاً در', optional: true, render: (u) => u.exampleGame || '—' },
    { key: 'last', header: 'آخرین بار', optional: true, render: (u) => u.lastSeenFa },
    { key: 'actions', header: '', render: (u) => <Button size="sm" onClick={() => onRegister(u.code)}>ثبت</Button> },
  ];
  return (
    <Card title="تگ‌های ثبت‌نشده" padded={false}
      description="این کدها را بازی‌ها در ۶۰ روزِ اخیر فرستاده‌اند ولی این‌جا نیستند؛ تا ثبت نشوند والدین این مفهوم را نمی‌بینند. اگر غلطِ املایی است، به تیمِ بازی‌سازی خبر دهید.">
      <DataTable caption="تگ‌های ثبت‌نشده" columns={columns} rows={rows} rowKey={(u) => u.code} />
    </Card>
  );
}

export function ConceptsPage() {
  const { values, set, reset, active } = useQueryState();
  const toast = useToast();
  const meta = useMeta().data;
  const { data, error, isFetching, refetch } = useConcepts(values);
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<ConceptRow | null>(null);
  const remove = useAction<object>('delete', () => `concepts/${removing?.id}`, ['concepts']);

  const columns: Column<ConceptRow>[] = [
    { key: 'title', header: 'تگ', render: (c) => <span className={styles.cell}><b>{c.title}</b><small className={styles.ltr}>{c.code}</small></span> },
    { key: 'subject', header: 'درس', render: (c) => c.subjectLabel || '—' },
    { key: 'grade', header: 'پایه', optional: true, render: (c) => (c.grade ? faNum(c.grade) : 'همه') },
    { key: 'usage', header: 'پاسخ (۳۰ روز)', render: (c) => (c.answers
      ? <span className={styles.cell}><b>{faNum(c.answers)}</b><small>{faNum(c.errors)} خطا · {faNum(c.games)} بازی</small></span>
      : <Badge tone="gray">هنوز استفاده نشده</Badge>) },
    { key: 'active', header: 'وضعیت', render: (c) => (c.isActive ? <Badge tone="green">فعال</Badge> : <Badge tone="gray">غیرفعال</Badge>) },
    { key: 'actions', header: '', render: (c) => (
      <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setRemoving(c); }}>حذف</Button>) },
  ];
  const grades = (meta?.grades ?? []).map((g) => ({ value: String(g.value), label: g.label }));

  return (
    <>
      <PageHeader title="تگ‌های آموزشی"
        description="هر سؤالِ بازی یک تگِ آموزشی دارد؛ تیمِ طراحی این‌جا تعریف می‌کند، بازی‌ها همان کد را می‌فرستند و پنلِ والدین با عنوانش نشان می‌دهد."
        actions={<Button variant="primary" icon={<HiOutlinePlus aria-hidden />} onClick={() => setEditing({ concept: null })}>تگِ تازه</Button>} />
      <div className={styles.stack}>
        <UnknownCodes onRegister={(code) => setEditing({ concept: null, code })} />
        <div className={styles.tableCard}>
          <FilterBar onReset={reset} active={active}>
            <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="کد، عنوان یا توضیح…" />
            <SelectFilter label="درس" value={values.subject ?? ''} options={meta?.conceptSubjects ?? []} onChange={(subject) => set({ subject })} />
            <SelectFilter label="پایه" value={values.grade ?? ''} options={grades} onChange={(grade) => set({ grade })} />
            <SelectFilter label="وضعیت" value={values.active ?? ''} onChange={(v) => set({ active: v })}
              options={[{ value: 'true', label: 'فعال' }, { value: 'false', label: 'غیرفعال' }]} />
          </FilterBar>
          {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
            <DataTable caption="تگ‌های آموزشی" columns={columns} rows={data?.results} rowKey={(c) => c.id} loading={isFetching}
              onRowClick={(c) => setEditing({ concept: c })} empty="تگی نیست؛ اولی را اضافه کنید." />
          )}
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
        </div>
      </div>
      {editing && <ConceptForm key={editing.concept?.id ?? `new-${editing.code ?? ''}`} concept={editing.concept}
        suggestedCode={editing.code} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={Boolean(removing)} title="حذفِ تگ" danger confirmLabel="حذف شود" busy={remove.isPending}
        message={`«${removing?.title}» (${removing?.code}) پاک می‌شود. تگی که در بازی‌ها استفاده شده حذف نمی‌شود؛ غیرفعالش کنید.`}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove.mutateAsync({}).then(() => { toast('حذف شد.'); setRemoving(null); })
          .catch((e: unknown) => toast(messageOf(e), 'error'))} />
    </>
  );
}
