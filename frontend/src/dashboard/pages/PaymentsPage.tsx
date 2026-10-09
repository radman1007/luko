import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { DataTable } from '../components/DataTable/DataTable';
import type { Column } from '../components/DataTable/DataTable';
import { DateFilter, FilterBar, SearchBox, SelectFilter } from '../components/Filters/Filters';
import { ConfirmDialog } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Pagination } from '../components/Pagination/Pagination';
import { ErrorState } from '../components/States/States';
import { useToast } from '../components/Toast/toastContext';
import { useSession } from '../features/auth/useSession';
import { useAction, useMeta, usePayments } from '../features/data/hooks';
import { messageOf } from '../lib/api';
import { faNum, toman } from '../lib/format';
import { useQueryState } from '../lib/useQueryState';
import type { PaymentRow } from '../types';
import styles from './Pages.module.css';

const STATUSES = [
  { value: 'paid', label: 'پرداخت‌شده' }, { value: 'pending', label: 'در انتظار' },
  { value: 'failed', label: 'ناموفق' }, { value: 'expired', label: 'منقضی/لغو' },
];
const SOURCES = [{ value: 'gateway', label: 'درگاه' }, { value: 'gift', label: 'هدیه' }];
const TONE = { paid: 'green', pending: 'amber', failed: 'red', expired: 'gray' } as const;

export function PaymentsPage() {
  const { values, set, reset, active } = useQueryState();
  const { can } = useSession();
  const toast = useToast();
  const plans = (useMeta().data?.plans ?? []).map((p) => ({ value: p.code, label: p.title }));
  const { data, error, isFetching, refetch } = usePayments(values);
  const [revoking, setRevoking] = useState<PaymentRow | null>(null);
  const revoke = useAction<object>('post', () => `payments/${revoking?.id}/revoke`, ['payments', 'user', 'users', 'overview']);

  const columns: Column<PaymentRow>[] = [
    { key: 'child', header: 'فرزند', render: (p) => (
      <span className={styles.cell}>
        {p.childId ? <Link to={`/users/${p.childId}`} onClick={(e) => e.stopPropagation()}>{p.childName || '—'}</Link> : (p.childName || '—')}
        <small className={styles.ltr}>{p.payerPhone}</small>
      </span>) },
    { key: 'plan', header: 'پلن', render: (p) => <span className={styles.cell}><b>{p.planTitle}</b><small>{faNum(p.days)} روز</small></span> },
    { key: 'amount', header: 'مبلغ', render: (p) => p.source === 'gift'
      ? <span className={styles.cell}><Badge tone="violet">هدیه</Badge><small>{p.grantedBy}</small></span> : toman(p.amountToman) },
    { key: 'status', header: 'وضعیت', render: (p) => <Badge tone={TONE[p.status]} dot>{p.statusLabel}</Badge> },
    { key: 'factor', header: 'فاکتور / پیگیری', optional: true, render: (p) => (
      <span className={styles.cell}><small className={styles.ltr}>{p.factor}</small><small className={styles.ltr}>{p.transId}</small></span>) },
    { key: 'at', header: 'زمان', render: (p) => <span className={styles.cell}><span>{p.paidFa || p.createdFa}</span>
      {p.endsFa && <small>تا {p.endsFa}</small>}</span> },
    { key: 'act', header: '', render: (p) => can('gifts') && p.source === 'gift' && p.status === 'paid'
      ? <Button size="sm" variant="danger" onClick={() => setRevoking(p)}>لغوِ هدیه</Button> : null },
  ];

  return (
    <>
      <PageHeader title="پرداخت‌ها" description="همه‌ی رفت‌وبرگشت‌ها به درگاه و اشتراک‌های هدیه" />
      <div className={styles.tableCard}>
        <FilterBar onReset={reset} active={active}>
          <SearchBox value={values.q ?? ''} onChange={(q) => set({ q })} placeholder="فاکتور، شماره، نامِ فرزند، کدِ پیگیری…" />
          <SelectFilter label="وضعیت" value={values.status ?? ''} options={STATUSES} onChange={(status) => set({ status })} />
          <SelectFilter label="منبع" value={values.source ?? ''} options={SOURCES} onChange={(source) => set({ source })} />
          <SelectFilter label="پلن" value={values.plan ?? ''} options={plans} onChange={(plan) => set({ plan })} />
          <DateFilter label="از" value={values.from ?? ''} onChange={(from) => set({ from })} />
          <DateFilter label="تا" value={values.to ?? ''} onChange={(to) => set({ to })} />
        </FilterBar>
        {data && (
          <div className={styles.summary}>
            <span>پرداختِ موفق: <b>{faNum(data.summary.paid)}</b></span>
            <span>جمعِ فروش: <b>{toman(data.summary.paidToman)}</b></span>
            <span>هدیه: <b>{faNum(data.summary.gifts)}</b></span>
          </div>
        )}
        {error && !data ? <ErrorState message={messageOf(error)} onRetry={() => void refetch()} /> : (
          <DataTable caption="پرداخت‌ها" columns={columns} rows={data?.results} rowKey={(p) => p.id} loading={isFetching}
            empty="پرداختی با این فیلترها نیست." />
        )}
        {data && <Pagination page={data.page} pages={data.pages} count={data.count} onChange={(page) => set({ page }, true)} />}
      </div>
      <ConfirmDialog open={Boolean(revoking)} title="لغوِ اشتراکِ هدیه" danger confirmLabel="لغو کن" busy={revoke.isPending}
        message={revoking ? `${faNum(revoking.days)} روز هدیه‌ی ${revoking.childName} برداشته می‌شود. پرداخت‌های واقعی دست نمی‌خورند.` : ''}
        onClose={() => setRevoking(null)}
        onConfirm={() => void revoke.mutateAsync({}).then(() => { toast('هدیه لغو شد.'); setRevoking(null); })
          .catch((e: unknown) => toast(messageOf(e), 'error'))} />
    </>
  );
}
