import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineArrowRightOnRectangle, HiOutlineGift, HiOutlineMegaphone, HiOutlinePencilSquare } from 'react-icons/hi2';
import { Button } from '../../components/Button/Button';
import { Check, FormGrid, SelectField, TextArea, TextField } from '../../components/Fields/Fields';
import { ConfirmDialog, Modal } from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/toastContext';
import { useSession } from '../../features/auth/useSession';
import { useAction, useMeta } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum, latinDigits } from '../../lib/format';
import type { UserDetail } from '../../types';
import styles from '../Pages.module.css';

const GIFT_DAYS = [7, 14, 30, 90];

/** کارهای پشتیبانی روی یک کاربر — هر دکمه فقط اگر دسترسی‌اش هست */
export function UserActions({ user }: { user: UserDetail }) {
  const { can, me } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const grades = useMeta().data?.grades ?? [];
  const [modal, setModal] = useState<'edit' | 'logout' | 'gift' | null>(null);
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, grade: String(user.grade ?? 1), isActive: user.isActive });
  const [gift, setGift] = useState({ days: '30', note: '' });
  const keys = ['user', 'users', 'payments', 'overview'];
  const edit = useAction<typeof form>('patch', `users/${user.id}`, keys);
  const logoutAll = useAction<object>('post', `users/${user.id}/logout-all`, keys);
  const grant = useAction<{ childId: number; days: number; note: string }>('post', 'payments/gift', keys);
  const isTeam = user.role === 'staff' || user.role === 'admin';
  const canEdit = can('users_edit') && (!isTeam || me?.isSuperuser);
  const close = () => setModal(null);

  const run = async (job: Promise<unknown>, ok: string) => {
    try {
      await job;
      toast(ok);
      close();
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  };

  return (
    <div className={styles.inline}>
      {can('gifts') && user.role === 'student' && (
        <Button icon={<HiOutlineGift aria-hidden />} onClick={() => setModal('gift')}>هدیه‌ی اشتراک</Button>
      )}
      {can('notify') && (user.role === 'student' || user.role === 'parent') && (
        <Button icon={<HiOutlineMegaphone aria-hidden />} onClick={() => navigate(
          `/notices?audience=${user.role === 'student' ? 'students' : 'parents'}&filters=${encodeURIComponent(JSON.stringify({ ids: String(user.id) }))}`)}>
          اعلان
        </Button>
      )}
      {canEdit && <Button icon={<HiOutlineArrowRightOnRectangle aria-hidden />} onClick={() => setModal('logout')}>خروج از همه‌ی دستگاه‌ها</Button>}
      {canEdit && <Button variant="primary" icon={<HiOutlinePencilSquare aria-hidden />} onClick={() => setModal('edit')}>ویرایش</Button>}

      <Modal open={modal === 'edit'} title="ویرایشِ کاربر" onClose={close} footer={<>
        <Button onClick={close}>انصراف</Button>
        <Button variant="primary" loading={edit.isPending} onClick={() => void run(edit.mutateAsync(form), 'ذخیره شد.')}>ذخیره</Button>
      </>}>
        <FormGrid>
          <TextField label="نام" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <TextField label="نامِ خانوادگی" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          {user.role === 'student' && (
            <SelectField label="پایه" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}
              options={grades.map((g) => ({ value: String(g.value), label: g.label }))} />
          )}
        </FormGrid>
        <div style={{ marginTop: 14 }}>
          <Check label="حساب فعال است" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })}
            description="بستنِ حساب، کاربر را همان لحظه از اپ بیرون می‌کند و دیگر نمی‌تواند وارد شود." />
        </div>
      </Modal>

      <ConfirmDialog open={modal === 'logout'} title="خروج از همه‌ی دستگاه‌ها" busy={logoutAll.isPending}
        message={`${user.name} از همه‌ی گوشی‌ها و مرورگرها بیرون می‌رود و باید دوباره وارد شود (مثلاً وقتی گوشی گم شده).`}
        confirmLabel="بیرونش کن" danger onClose={close}
        onConfirm={() => void run(logoutAll.mutateAsync({}), 'از همه‌ی دستگاه‌ها خارج شد.')} />

      <Modal open={modal === 'gift'} title={`هدیه‌ی اشتراک برای ${user.name}`} onClose={close} footer={<>
        <Button onClick={close}>انصراف</Button>
        <Button variant="primary" loading={grant.isPending} onClick={() => void run(
          grant.mutateAsync({ childId: user.id, days: Number(latinDigits(gift.days)), note: gift.note }),
          `${faNum(Number(latinDigits(gift.days)))} روز اشتراک هدیه داده شد.`)}>هدیه بده</Button>
      </>}>
        <p className={styles.muted} style={{ marginBottom: 12 }}>
          پشتِ اشتراکِ فعلی می‌نشیند و به والدین اعلان می‌رود. در صورت‌حساب با برچسبِ «هدیه» و مبلغِ صفر دیده می‌شود.
        </p>
        <div className={styles.tabs} role="group" aria-label="مدت">
          {GIFT_DAYS.map((d) => (
            <button key={d} type="button" aria-pressed={gift.days === String(d)} onClick={() => setGift({ ...gift, days: String(d) })}>
              {faNum(d)} روز
            </button>
          ))}
        </div>
        <FormGrid>
          <TextField label="مدت (روز)" value={gift.days} inputMode="numeric" onChange={(e) => setGift({ ...gift, days: e.target.value })} />
        </FormGrid>
        <div style={{ marginTop: 14 }}>
          <TextArea label="یادداشت (برای تیم)" value={gift.note} maxLength={200} rows={2}
            onChange={(e) => setGift({ ...gift, note: e.target.value })} placeholder="مثلاً: جبرانِ قطعیِ ۳ مهر" />
        </div>
      </Modal>
    </div>
  );
}
