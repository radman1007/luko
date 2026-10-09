import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineAdjustmentsHorizontal, HiOutlineMegaphone } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { DataTable } from '../../components/DataTable/DataTable';
import type { Column } from '../../components/DataTable/DataTable';
import { ChipFilter, DateFilter, FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Pagination } from '../../components/Pagination/Pagination';
import { ErrorState } from '../../components/States/States';
import { useSession } from '../../features/auth/useSession';
import { useMeta, useUsers } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { useQueryState } from '../../lib/useQueryState';
import type { UserRow } from '../../types';
import { ChildrenSummary, RoleBadge, SeenCell, SubBadge } from './badges';
import styles from '../Pages.module.css';

const ROLES = [
  { value: 'student', label: 'دانش‌آموز' }, { value: 'parent', label: 'والد' },
  { value: 'staff', label: 'کارمند' }, { value: 'admin', label: 'مدیرِ کل' },
];
const SUBS = [{ value: 'active', label: 'فعال' }, { value: 'renewal', label: 'نیاز به تمدید' }, { value: 'inactive', label: 'غیرفعال' }];
const PLATFORMS = [{ value: 'web', label: 'وب (۳۰ روز)' }, { value: 'android', label: 'اندروید (۳۰ روز)' }];
const ORDERS = [{ value: '-seen', label: 'تازه‌ترین بازدید' }, { value: 'name', label: 'نام' }, { value: 'joined', label: 'قدیمی‌ترین عضو' }];
const YES_NO = [{ value: 'true', label: 'بله' }, { value: 'false', label: 'خیر' }];
const NOTICE_KEYS = ['q', 'grade', 'sub', 'seen', 'platform', 'joined_from', 'joined_to', 'verified', 'has_children'];

const COLUMNS: Column<UserRow>[] = [
  { key: 'name', header: 'کاربر', render: (u) => (
    <span className={styles.cell}><b>{u.name}</b><small className={styles.ltr}>{u.phone}</small></span>) },
  { key: 'role', header: 'سطحِ دسترسی', render: (u) => <RoleBadge role={u.role} label={u.roleLabel} /> },
  { key: 'sub', header: 'اشتراک', render: (u) => u.subscription ? <SubBadge sub={u.subscription} />
    : u.children ? <ChildrenSummary summary={u.children} /> : <span className={styles.muted}>—</span> },
  { key: 'grade', header: 'پایه', optional: true, render: (u) => u.gradeLabel || '—' },
  { key: 'seen', header: 'آخرین بازدید', render: (u) => <SeenCell seen={u.lastSeen} /> },
  { key: 'joined', header: 'عضویت', optional: true, render: (u) => u.joinedFa },
  { key: 'state', header: 'حساب', optional: true, render: (u) => u.isActive ? <Badge tone="green">فعال</Badge>
    : <Badge tone="red">بسته</Badge> },
];

export function UsersPage() {
  const { values, set, reset, active } = useQueryState();
  const [more, setMore] = useState(Boolean(values.joined_from || values.joined_to || values.verified || values.has_children || values.active));
  const navigate = useNavigate();
  const { can } = useSession();
  const meta = useMeta().data;
  const { data, error, isFetching, refetch } = useUsers({ ...values, order: values.order ?? '-joined' });
  const grades = (meta?.grades ?? []).map((g) => ({ value: String(g.value), label: g.label }));
  const audience = values.role === 'student' ? 'students' : values.role === 'parent' ? 'parents' : '';

  const notify = () => {
    const filters = Object.fromEntries(NOTICE_KEYS.filter((k) => values[k]).map((k) => [k, values[k]]));
    navigate(`/notices?audience=${audience}&filters=${encodeURIComponent(JSON.stringify(filters))}`);
  };

  return (
    <>
      <PageHeader title="کاربران"
        description={data ? `${faNum(data.count)} نفر با این فیلترها — ${faNum(data.summary.students)} دانش‌آموز، ${faNum(data.summary.parents)} والد` : 'همه‌ی حساب‌ها'}
        actions={can('notify') && audience ? (
          <Button variant="primary" icon={<HiOutlineMegaphone aria-hidden />} onClick={notify}>اعلان به همین فهرست</Button>) : undefined} />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="نام، شماره یا شناسه…" />
          <SelectFilter label="سطحِ دسترسی" value={values.role ?? ''} options={ROLES} onChange={(role) => set({ role })} />
          <SelectFilter label="پایه" value={values.grade ?? ''} options={grades} onChange={(grade) => set({ grade })} />
          <SelectFilter label="آخرین بازدید" value={values.seen ?? ''} onChange={(seen) => set({ seen })}
            options={meta?.lastSeen ?? []} allLabel="هر زمان" />
          <SelectFilter label="سکو" value={values.platform ?? ''} options={PLATFORMS} onChange={(platform) => set({ platform })} />
          <SelectFilter label="ترتیب" value={values.order ?? ''} allLabel="تازه‌ترین عضو" options={ORDERS} onChange={(order) => set({ order })} />
          <Button variant="ghost" icon={<HiOutlineAdjustmentsHorizontal aria-hidden />} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            فیلترهای بیشتر
          </Button>
        </FilterBar>
        <FilterBar>
          <ChipFilter label="اشتراک:" value={values.sub ?? ''} options={SUBS} onChange={(sub) => set({ sub })} />
        </FilterBar>
        {more && (
          <FilterBar>
            <DateFilter label="عضویت از" value={values.joined_from ?? ''} onChange={(v) => set({ joined_from: v })} />
            <DateFilter label="تا" value={values.joined_to ?? ''} onChange={(v) => set({ joined_to: v })} />
            <SelectFilter label="شماره تأییدشده" value={values.verified ?? ''} options={YES_NO} onChange={(v) => set({ verified: v })} />
            <SelectFilter label="فرزند دارد (والد)" value={values.has_children ?? ''} options={YES_NO} onChange={(v) => set({ has_children: v })} />
            <SelectFilter label="حساب" value={values.active ?? ''} onChange={(v) => set({ active: v })}
              options={[{ value: 'true', label: 'فعال' }, { value: 'false', label: 'بسته' }]} />
          </FilterBar>
        )}
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="فهرستِ کاربران" columns={COLUMNS} rows={data?.results} rowKey={(u) => u.id}
            loading={isFetching} onRowClick={(u) => navigate(`/users/${u.id}`)}
            empty="با این فیلترها کاربری نیست." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
    </>
  );
}
