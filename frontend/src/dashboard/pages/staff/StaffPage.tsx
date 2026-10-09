import { useState } from 'react';
import { HiOutlineKey, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineSparkles } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { TextField } from '../../components/Fields/Fields';
import { ConfirmDialog, Modal } from '../../components/Modal/Modal';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { ErrorState, Loading } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useMeta, useStaff } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import type { StaffRow } from '../../types';
import { strongPassword } from '../../lib/password';
import { StaffForm } from './StaffForm';
import styles from '../Pages.module.css';
import own from './Staff.module.css';

export function StaffPage() {
  const toast = useToast();
  const { data, error, isLoading, refetch } = useStaff();
  const labels = Object.fromEntries((useMeta().data?.capabilities ?? []).map((c) => [c.key, c.label]));
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [removing, setRemoving] = useState<StaffRow | null>(null);
  const [password, setPassword] = useState('');
  const reset = useAction<{ password: string }>('post', () => `staff/${resetting?.id}/password`, ['staff']);
  const remove = useAction<object>('delete', () => `staff/${removing?.id}`, ['staff']);
  if (isLoading) return <Loading />;
  if (!data) return <ErrorState message={messageOf(error)} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader title="کارمندان و دسترسی‌ها"
        description="هر کارمند فقط بخش‌هایی را می‌بیند که برایش تیک خورده. ورود همیشه با رمز + کدِ پیامکی است."
        actions={<Button variant="primary" icon={<HiOutlinePlus aria-hidden />} onClick={() => setEditing('new')}>کارمندِ تازه</Button>} />
      <div className={own.grid}>
        {data.results.map((s) => (
          <Card key={s.id} title={s.name} description={<span className={styles.ltr}>{s.phone}</span>}
            actions={s.isSuperuser ? <Badge tone="red">مدیرِ کل</Badge> : (s.isActive ? <Badge tone="green">فعال</Badge> : <Badge tone="gray">غیرفعال</Badge>)}>
            <p className={own.title}>{s.title || '—'}</p>
            <div className={styles.inline}>
              {s.isSuperuser ? <Badge tone="violet">همه‌ی دسترسی‌ها + تعریفِ کارمند</Badge>
                : s.capabilities.map((c) => <Badge key={c} tone="teal">{labels[c] ?? c}</Badge>)}
            </div>
            <p className={own.meta}>آخرین ورود: {s.lastLoginFa || 'هنوز نه'}</p>
            {!s.isSuperuser && (
              <div className={own.actions}>
                <Button size="sm" icon={<HiOutlinePencilSquare aria-hidden />} onClick={() => setEditing(s)}>دسترسی‌ها</Button>
                <Button size="sm" icon={<HiOutlineKey aria-hidden />} onClick={() => { setPassword(''); setResetting(s); }}>رمزِ تازه</Button>
                <Button size="sm" variant="danger" onClick={() => setRemoving(s)}>برداشتنِ دسترسی</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {editing && <StaffForm key={editing === 'new' ? 'new' : editing.id} staff={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <Modal open={Boolean(resetting)} title={`رمزِ تازه برای ${resetting?.name ?? ''}`} onClose={() => setResetting(null)} footer={<>
        <Button onClick={() => setResetting(null)}>انصراف</Button>
        <Button variant="primary" loading={reset.isPending} onClick={() => void reset.mutateAsync({ password })
          .then(() => { toast('رمز عوض شد؛ نشست‌های قبلیِ او بسته شد.'); setResetting(null); })
          .catch((e: unknown) => toast(messageOf(e), 'error'))}>ذخیره</Button>
      </>}>
        <div className={own.password}>
          <TextField label="رمزِ تازه" value={password} dir="ltr" autoComplete="new-password" hint="دست‌کم ۱۰ نویسه"
            onChange={(e) => setPassword(e.target.value)} />
          <Button icon={<HiOutlineSparkles aria-hidden />} onClick={() => setPassword(strongPassword())}>رمزِ قوی بساز</Button>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(removing)} title="برداشتنِ دسترسی" danger confirmLabel="بردار" busy={remove.isPending}
        message={`${removing?.name ?? ''} دیگر نمی‌تواند وارد داشبورد شود. سابقه‌ی کارهایش در گزارش می‌ماند.`}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove.mutateAsync({}).then(() => { toast('دسترسی برداشته شد.'); setRemoving(null); })
          .catch((e: unknown) => toast(messageOf(e), 'error'))} />
    </>
  );
}
