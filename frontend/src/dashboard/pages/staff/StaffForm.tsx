import { useState } from 'react';
import { HiOutlineSparkles } from 'react-icons/hi2';
import { Button } from '../../components/Button/Button';
import { Check, FormGrid, TextField } from '../../components/Fields/Fields';
import { Modal } from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useMeta } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { latinDigits } from '../../lib/format';
import { strongPassword } from '../../lib/password';
import type { Capability, StaffRow } from '../../types';
import own from './Staff.module.css';

interface Props {
  staff: StaffRow | null;
  onClose: () => void;
}

export function StaffForm({ staff, onClose }: Props) {
  const toast = useToast();
  const caps = useMeta().data?.capabilities ?? [];
  const [form, setForm] = useState({
    phone: staff?.phone ?? '', firstName: staff?.firstName ?? '', lastName: staff?.lastName ?? '',
    title: staff?.title ?? '', password: '', isActive: staff?.isActive ?? true,
  });
  const [chosen, setChosen] = useState<Set<Capability>>(new Set(staff?.capabilities ?? []));
  const create = useAction<object>('post', 'staff', ['staff']);
  const update = useAction<object>('patch', `staff/${staff?.id}`, ['staff']);
  const busy = create.isPending || update.isPending;

  const toggle = (key: Capability, on: boolean) => setChosen((s) => {
    const next = new Set(s);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  });

  const save = async () => {
    const capabilities = [...chosen];
    try {
      if (staff) {
        await update.mutateAsync({ firstName: form.firstName, lastName: form.lastName, title: form.title, isActive: form.isActive, capabilities });
      } else {
        await create.mutateAsync({ ...form, phone: latinDigits(form.phone), capabilities });
      }
      toast(staff ? 'دسترسی‌ها ذخیره شد.' : 'کارمند تعریف شد؛ رمز را جای امنی به او بدهید.');
      onClose();
    } catch (e) {
      toast(messageOf(e), 'error');
    }
  };

  return (
    <Modal open wide title={staff ? `دسترسی‌های ${staff.name}` : 'کارمندِ تازه'} onClose={onClose} footer={<>
      <Button onClick={onClose}>انصراف</Button>
      <Button variant="primary" loading={busy} disabled={chosen.size === 0} onClick={() => void save()}>ذخیره</Button>
    </>}>
      <FormGrid>
        <TextField label="شماره‌ی موبایل" value={form.phone} dir="ltr" inputMode="tel" disabled={Boolean(staff)}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} hint={staff ? 'شماره عوض نمی‌شود' : 'کدِ ورود به همین شماره پیامک می‌شود'} />
        <TextField label="نام" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <TextField label="نامِ خانوادگی" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <TextField label="سمت" value={form.title} placeholder="مثلاً نویسنده‌ی وبلاگ" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </FormGrid>
      {!staff && (
        <div className={own.password}>
          <TextField label="رمزِ اولیه" value={form.password} dir="ltr" autoComplete="new-password"
            hint="دست‌کم ۱۰ نویسه، نه فقط عدد" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button icon={<HiOutlineSparkles aria-hidden />} onClick={() => setForm({ ...form, password: strongPassword() })}>رمزِ قوی بساز</Button>
        </div>
      )}
      <h3 className={own.capsTitle}>دسترسی‌ها — هر کدام را جدا تیک بزنید</h3>
      <div className={own.caps}>
        {caps.map((c) => (
          <Check key={c.key} label={c.label} description={c.description} checked={chosen.has(c.key)} onChange={(on) => toggle(c.key, on)} />
        ))}
      </div>
      {staff && (
        <div style={{ marginTop: 14 }}>
          <Check label="حساب فعال است" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })}
            description="غیرفعال یعنی همان لحظه از داشبورد بیرون می‌رود." />
        </div>
      )}
    </Modal>
  );
}
