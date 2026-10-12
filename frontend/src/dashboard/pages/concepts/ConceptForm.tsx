import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Check, FormGrid, SelectField, TextArea, TextField } from '../../components/Fields/Fields';
import { Modal } from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useMeta } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import type { ConceptRow } from '../../types';

interface Props {
  concept: ConceptRow | null;
  /** کدِ پیشنهادی (از «ثبت‌نشده‌ها») برای تگِ تازه */
  suggestedCode?: string;
  onClose: () => void;
}

const CODE_RE = /^[a-z][a-z0-9_-]{0,63}$/;

/** تعریف یا ویرایشِ تگِ آموزشی */
export function ConceptForm({ concept, suggestedCode = '', onClose }: Props) {
  const meta = useMeta().data;
  const toast = useToast();
  const [form, setForm] = useState({
    code: concept?.code ?? suggestedCode,
    title: concept?.title ?? '',
    subject: concept?.subject ?? '',
    grade: concept?.grade ? String(concept.grade) : '',
    description: concept?.description ?? '',
    isActive: concept?.isActive ?? true,
  });
  const save = useAction<typeof form>(concept ? 'patch' : 'post', concept ? `concepts/${concept.id}` : 'concepts', ['concepts']);
  const code = form.code.trim().toLowerCase();
  const codeOk = CODE_RE.test(code);

  const submit = () => {
    save.mutateAsync({ ...form, code })
      .then(() => { toast(concept ? 'تگ ذخیره شد.' : 'تگ اضافه شد.'); onClose(); })
      .catch((error: unknown) => toast(messageOf(error), 'error'));
  };

  const subjects = [{ value: '', label: '—' }, ...(meta?.conceptSubjects ?? [])];
  const grades = [{ value: '', label: 'همه‌ی پایه‌ها' }, ...(meta?.grades ?? []).map((g) => ({ value: String(g.value), label: g.label }))];
  return (
    <Modal open wide title={concept ? `ویرایشِ «${concept.title}»` : 'تگِ آموزشیِ تازه'} onClose={onClose} footer={<>
      <Button onClick={onClose}>انصراف</Button>
      <Button variant="primary" loading={save.isPending} onClick={submit} disabled={!codeOk || !form.title.trim()}>ذخیره</Button>
    </>}>
      <FormGrid>
        <TextField label="کد" dir="ltr" value={form.code} required placeholder="addition_2digit"
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          error={form.code && !codeOk ? 'فقط حروفِ کوچکِ انگلیسی، رقم، _ و -؛ با حرف شروع شود.' : undefined}
          hint={concept && concept.answers > 0 ? 'این کد در بازی‌ها استفاده شده؛ عوض‌کردنش آمار را جدا می‌کند.'
            : 'همین کد را تیمِ بازی‌سازی روی هر پاسخ می‌فرستد.'} />
        <TextField label="عنوان برای والدین" value={form.title} required placeholder="جمعِ دو رقمی"
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <SelectField label="درس" value={form.subject} options={subjects} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <SelectField label="پایه" value={form.grade} options={grades} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
      </FormGrid>
      <div style={{ marginTop: 14 }}>
        <TextArea label="توضیح برای تیمِ بازی‌سازی" rows={3} value={form.description}
          placeholder="این مفهوم دقیقاً چه چیزی را می‌سنجد؟ یک سؤالِ نمونه، و خطاهای رایج."
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Check label="فعال" description="تگِ غیرفعال به والدین نشان داده نمی‌شود؛ رویدادهایش ذخیره می‌ماند."
          checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
      </div>
    </Modal>
  );
}
