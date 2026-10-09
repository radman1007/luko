import { useNavigate } from 'react-router-dom';
import {
  HiOutlineBolt, HiOutlineChatBubbleLeftRight, HiOutlineCreditCard, HiOutlineSignal, HiOutlineSparkles,
  HiOutlineUserGroup, HiOutlineUsers,
} from 'react-icons/hi2';
import { Badge } from '../components/Badge/Badge';
import { Card } from '../components/Card/Card';
import { BarChart } from '../components/Charts/BarChart';
import { LineChart } from '../components/Charts/LineChart';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { StatCard } from '../components/StatCard/StatCard';
import { ErrorState, Loading } from '../components/States/States';
import { useOnline, useOverview } from '../features/data/hooks';
import { messageOf } from '../lib/api';
import { faNum, minutes, toman } from '../lib/format';
import { SubBadge } from './users/badges';
import styles from './Pages.module.css';

const ACTIVE_SERIES = [
  { key: 'web', label: 'وب', color: 'var(--chart-1)' },
  { key: 'android', label: 'اپِ اندروید', color: 'var(--chart-2)' },
];
const SIGNUP_SERIES = [
  { key: 'students', label: 'دانش‌آموز', color: 'var(--chart-1)' },
  { key: 'parents', label: 'والد', color: 'var(--chart-2)' },
];

export function OverviewPage() {
  const { data, error, refetch, isLoading } = useOverview();
  const online = useOnline().data ?? data?.online;
  const navigate = useNavigate();
  if (isLoading) return <Loading />;
  if (!data) return <ErrorState message={messageOf(error)} onRetry={() => void refetch()} />;
  const { users, active, subscriptions, tickets, series, latest } = data;

  return (
    <>
      <PageHeader title="نمای کلی" description="حالِ امروزِ لوکو در یک نگاه؛ اعداد خودکار تازه می‌شوند." />
      <div className={styles.stats}>
        <StatCard live label="همین حالا آنلاین" value={faNum(online?.total ?? 0)} icon={<HiOutlineSignal />}
          hint={`وب ${faNum(online?.web ?? 0)} · اندروید ${faNum(online?.android ?? 0)}`} />
        <StatCard label="فعالِ امروز" value={faNum(active.today)} icon={<HiOutlineBolt />} tone="orange"
          hint={`میانگینِ ${minutes(active.todayAvgMinutes)} در هر نفر`} />
        <StatCard label="فعالِ ۷ روزِ اخیر" value={faNum(active.week)} icon={<HiOutlineUserGroup />} tone="violet"
          hint={`میانگینِ ${minutes(active.weekAvgMinutes)} در روز`} />
        <StatCard label="کاربران" value={faNum(users.students + users.parents)} icon={<HiOutlineUsers />} tone="blue"
          hint={`${faNum(users.students)} دانش‌آموز · ${faNum(users.parents)} والد · ${faNum(users.newToday)} تازه امروز`} />
        <StatCard label="اشتراکِ فعال" value={faNum(subscriptions.active)} icon={<HiOutlineSparkles />} tone="green"
          hint={`${faNum(subscriptions.expiring)} تا یک هفته‌ی دیگر تمام می‌شود`} />
        <StatCard label={`فروشِ ${subscriptions.monthLabel} (تومان)`} value={faNum(subscriptions.monthSalesToman)}
          icon={<HiOutlineCreditCard />} tone="teal" hint={`${faNum(subscriptions.monthPaid)} پرداختِ موفق`} />
        <StatCard label="تیکتِ باز" value={faNum(tickets.open)} icon={<HiOutlineChatBubbleLeftRight />}
          tone={tickets.open ? 'red' : 'teal'} hint={`${faNum(tickets.answered)} پاسخ داده شده`} />
      </div>

      <div className={styles.grid2}>
        <Card title="کاربرانِ فعال در ۳۰ روزِ اخیر" description="بازدیدکننده‌ی یکتا در هر روز، جدا برای وب و اپ">
          <LineChart title="کاربرانِ فعالِ روزانه" series={ACTIVE_SERIES}
            points={series.active.map((p) => ({ label: p.label, values: { web: p.web, android: p.android } }))} />
        </Card>
        <Card title="ثبت‌نامِ تازه" description="۳۰ روزِ اخیر">
          <BarChart title="ثبت‌نامِ روزانه" series={SIGNUP_SERIES}
            points={series.signups.map((p) => ({ label: p.label, values: { students: p.students, parents: p.parents } }))} />
        </Card>
      </div>

      <div className={styles.grid3}>
        {latest.signups && (
          <Card title="تازه‌ترین ثبت‌نام‌ها" actions={<button type="button" className={styles.linkBtn} onClick={() => navigate('/users')}>همه</button>}>
            <ul className={styles.list}>
              {latest.signups.map((u) => (
                <li key={u.id} onClick={() => navigate(`/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                  <span className={styles.cell}><b>{u.name}</b><small>{u.roleLabel} · {u.joinedFa}</small></span>
                  {u.subscription && <SubBadge sub={u.subscription} />}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {latest.payments && (
          <Card title="آخرین پرداخت‌ها" actions={<button type="button" className={styles.linkBtn} onClick={() => navigate('/payments')}>همه</button>}>
            <ul className={styles.list}>
              {latest.payments.map((p) => (
                <li key={p.id}>
                  <span className={styles.cell}><b>{p.childName || '—'}</b><small>{p.planTitle} · {p.paidFa}</small></span>
                  {p.source === 'gift' ? <Badge tone="violet">هدیه</Badge> : <b>{toman(p.amountToman)}</b>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {latest.tickets && (
          <Card title="تیکت‌های باز" actions={<button type="button" className={styles.linkBtn} onClick={() => navigate('/tickets')}>همه</button>}>
            {latest.tickets.length === 0 ? <p className={styles.muted}>تیکتِ بازی نیست.</p> : (
              <ul className={styles.list}>
                {latest.tickets.map((t) => (
                  <li key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} style={{ cursor: 'pointer' }}>
                    <span className={styles.cell}><b>{t.subject}</b><small>{t.user}</small></span>
                    <Badge tone="red" dot>باز</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
