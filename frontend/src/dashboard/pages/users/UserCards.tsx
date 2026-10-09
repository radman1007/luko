import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge/Badge';
import { Card } from '../../components/Card/Card';
import { BarChart } from '../../components/Charts/BarChart';
import { DataTable } from '../../components/DataTable/DataTable';
import { faNum, minutes, toman } from '../../lib/format';
import type { PaymentRow, UserDetail } from '../../types';
import { RoleBadge, SeenCell, SubBadge } from './badges';
import styles from '../Pages.module.css';
import own from './UserDetail.module.css';

export function InfoCard({ user }: { user: UserDetail }) {
  const rows: [string, ReactNode][] = [
    ['شماره', <span key="phone" className={styles.ltr}>{user.phone}</span>],
    ['سطحِ دسترسی', <RoleBadge key="role" role={user.role} label={user.roleLabel} />],
    ...(user.gradeLabel ? [['پایه', user.gradeLabel] as [string, ReactNode]] : []),
    ['عضویت', user.joinedStamp],
    ['آخرین بازدید', <SeenCell key="seen" seen={user.lastSeen} />],
    ['زمانِ دقیقِ بازدید', user.lastSeenStamp || '—'],
    ['آخرین ورود', user.lastLoginFa || '—'],
    ['شماره تأییدشده', user.phoneVerified ? 'بله' : 'خیر'],
    ['حساب', user.isActive ? <Badge key="state" tone="green">فعال</Badge> : <Badge key="state" tone="red">بسته</Badge>],
  ];
  return (
    <Card title="مشخصات">
      <dl className={own.dl}>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </Card>
  );
}

export function SubscriptionCard({ user }: { user: UserDetail }) {
  if (!user.subscription) return null;
  const sub = user.subscription;
  return (
    <Card title="اشتراک">
      <div className={own.subHead}>
        <SubBadge sub={sub} />
        {sub.daysLeft > 0 && <b>{faNum(sub.daysLeft)} روز مانده</b>}
      </div>
      <dl className={own.dl}>
        <div><dt>پلنِ جاری</dt><dd>{sub.plan || '—'}</dd></div>
        <div><dt>پایان</dt><dd>{sub.endsFa || '—'}</dd></div>
      </dl>
      {user.parents.length > 0 && (
        <>
          <h3 className={own.sub}>والدین</h3>
          <ul className={styles.list}>
            {user.parents.map((p) => (
              <li key={p.id}><Link to={`/users/${p.id}`}>{p.name}</Link><small className={styles.ltr}>{p.phone}</small></li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function ChildrenCard({ user }: { user: UserDetail }) {
  if (user.role !== 'parent') return null;
  return (
    <Card title="فرزندان">
      {user.childrenList.length === 0 ? <p className={styles.muted}>هنوز فرزندی اضافه نکرده.</p> : (
        <ul className={styles.list}>
          {user.childrenList.map((c) => (
            <li key={c.id}>
              <span className={styles.cell}><Link to={`/users/${c.id}`}>{c.name}</Link><small>{c.gradeLabel} · {c.lastSeen.fa}</small></span>
              <SubBadge sub={c.subscription} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ActivityCard({ user }: { user: UserDetail }) {
  const a = user.activity;
  return (
    <Card title="حضور در ۳۰ روزِ اخیر" description={`${faNum(a.activeDays)} روز آمده · وب ${minutes(a.webMinutes)} · اندروید ${minutes(a.androidMinutes)}`}>
      <BarChart title="دقیقه‌ی حضور در هر روز" height={170} series={[{ key: 'm', label: 'دقیقه', color: 'var(--chart-1)' }]}
        points={a.series.map((p) => ({ label: p.day, values: { m: p.minutes } }))} />
    </Card>
  );
}

export function ProgressCard({ user }: { user: UserDetail }) {
  const p = user.progress;
  if (!p) return null;
  const items: [string, string][] = [
    ['بازیِ تمام‌شده', faNum(p.gamesDone)], ['ستاره', faNum(p.stars)], ['سکه', faNum(p.coins)],
    ['امتیاز', faNum(p.points)], ['پادکستِ شنیده', faNum(p.podcastListens)],
  ];
  return (
    <Card title="پیشرفت" description={p.lastGame ? `آخرین بازی: ${p.lastGame} (${p.lastGameFa})` : 'هنوز بازی‌ای تمام نکرده'}>
      <div className={own.tiles}>
        {items.map(([k, v]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}
      </div>
    </Card>
  );
}

const PAY_COLUMNS = [
  { key: 'plan', header: 'پلن', render: (p: PaymentRow) => (
    <span className={styles.cell}><b>{p.planTitle}</b><small>{p.childName}</small></span>) },
  { key: 'amount', header: 'مبلغ', render: (p: PaymentRow) => p.source === 'gift' ? <Badge tone="violet">هدیه</Badge> : toman(p.amountToman) },
  { key: 'status', header: 'وضعیت', render: (p: PaymentRow) => (
    <Badge tone={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'gray'}>{p.statusLabel}</Badge>) },
  { key: 'at', header: 'زمان', render: (p: PaymentRow) => p.paidFa || p.createdFa },
];

export function PaymentsCard({ user }: { user: UserDetail }) {
  if (!user.payments.length) return null;
  return (
    <Card title="پرداخت‌ها و هدیه‌ها" padded={false}>
      <DataTable columns={PAY_COLUMNS} rows={user.payments} rowKey={(p) => p.id} />
    </Card>
  );
}
