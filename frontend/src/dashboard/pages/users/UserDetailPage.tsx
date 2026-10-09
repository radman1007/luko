import { Link, useParams } from 'react-router-dom';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Card } from '../../components/Card/Card';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { ErrorState, Loading } from '../../components/States/States';
import { useMeta, useUser } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { UserActions } from './UserActions';
import { ActivityCard, ChildrenCard, InfoCard, PaymentsCard, ProgressCard, SubscriptionCard } from './UserCards';
import styles from '../Pages.module.css';
import own from './UserDetail.module.css';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { data: user, error, isLoading, refetch } = useUser(id);
  const meta = useMeta().data;
  const capLabel = (key: string) => meta?.capabilities.find((c) => c.key === key)?.label ?? key;
  if (isLoading) return <Loading />;
  if (!user) return <ErrorState message={messageOf(error, 'کاربر پیدا نشد.')} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader title={user.name} description={`${user.roleLabel} · شناسه‌ی ${user.id}`}
        back={<Link to="/users" className={own.back}><HiOutlineChevronRight aria-hidden />کاربران</Link>}
        actions={<UserActions key={user.id + String(user.isActive)} user={user} />} />
      <div className={own.layout}>
        <div className={styles.stack}>
          <InfoCard user={user} />
          <SubscriptionCard user={user} />
          <ChildrenCard user={user} />
          {user.staff && (
            <Card title="دسترسی‌های داشبورد">
              <div className={styles.inline}>{user.staff.capabilities.map((c) => <Badge key={c} tone="violet">{capLabel(c)}</Badge>)}</div>
            </Card>
          )}
        </div>
        <div className={styles.stack}>
          <ActivityCard user={user} />
          <ProgressCard user={user} />
          <PaymentsCard user={user} />
          {user.tickets.length > 0 && (
            <Card title="تیکت‌ها">
              <ul className={styles.list}>
                {user.tickets.map((t) => (
                  <li key={t.id}><Link to={`/tickets/${t.id}`}>{t.subject}</Link>
                    <span className={styles.inline}><small>{t.updatedFa}</small><Badge tone={t.status === 'open' ? 'red' : 'gray'}>{t.statusLabel}</Badge></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {user.history.length > 0 && (
            <Card title="کارهای تیم روی این حساب">
              <ul className={`${styles.list} ${own.history}`}>
                {user.history.map((h, i) => (
                  <li key={i}><span className={styles.cell}><b>{h.action}</b><small>{h.by}</small></span><small>{h.at}</small></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
