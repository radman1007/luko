import { useState } from 'react';
import { HiOutlineAcademicCap, HiOutlineBell, HiOutlinePaperAirplane, HiOutlineUserGroup } from 'react-icons/hi2';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { FormGrid, SelectField, TextArea, TextField } from '../../components/Fields/Fields';
import { ConfirmDialog } from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/toastContext';
import { useAction } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { NoticeFilters } from './NoticeFilters';
import { useRecipients } from './useRecipients';
import own from './Notices.module.css';

type Audience = 'parents' | 'students';

const LINKS: Record<Audience, { value: string; label: string }[]> = {
  students: [
    { value: '', label: 'بی‌پیوند (فقط خبر)' }, { value: '/', label: 'خانه' }, { value: '/games', label: 'مسیرِ بازی‌ها' },
    { value: '/luko-podcast', label: 'پادکست' }, { value: '/luko-club', label: 'کلاب' }, { value: '/garden', label: 'باغچه' },
    { value: '/luko-health', label: 'سلامت' }, { value: '/profile', label: 'پروفایل' },
  ],
  parents: [
    { value: '', label: 'بی‌پیوند (فقط خبر)' }, { value: '/parent-panel', label: 'پنلِ والدین' },
    { value: '/parent-panel/subscription', label: 'اشتراک و صورت‌حساب' }, { value: '/parent-panel?open=support', label: 'پشتیبانی' },
  ],
};

interface Props {
  initialAudience: Audience | '';
  initialFilters: Record<string, string>;
  onSent: () => void;
}

export function Compose({ initialAudience, initialFilters, onSent }: Props) {
  const toast = useToast();
  const [audience, setAudience] = useState<Audience | ''>(initialAudience);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [msg, setMsg] = useState({ title: '', body: '', link: '' });
  const [confirm, setConfirm] = useState(false);
  const { preview, error } = useRecipients(audience, filters);
  const sendNotice = useAction<object, { recipients: number }>('post', 'notices/send', ['notices']);
  const patch = (p: Record<string, string>) => setFilters((f) => Object.fromEntries(Object.entries({ ...f, ...p }).filter(([, v]) => v)));
  const ready = audience && msg.title.trim() && (preview?.count ?? 0) > 0;

  const submit = async () => {
    try {
      const res = await sendNotice.mutateAsync({ audience, filters, ...msg });
      toast(`اعلان به ${faNum(res.recipients)} نفر رسید.`);
      setConfirm(false);
      setMsg({ title: '', body: '', link: '' });
      onSent();
    } catch (e) {
      toast(messageOf(e), 'error');
      setConfirm(false);
    }
  };

  return (
    <div className={own.layout}>
      <div className={own.main}>
        <Card title="۱. گیرندگان">
          <div className={own.audiences} role="radiogroup" aria-label="گیرندگان">
            {([['parents', 'والدین', 'در زنگوله‌ی پنلِ والدین', HiOutlineUserGroup],
              ['students', 'دانش‌آموزان', 'در صندوقِ پیام‌های خانه‌ی بچه‌ها', HiOutlineAcademicCap]] as const).map(([v, label, hint, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={audience === v} onClick={() => { setAudience(v); setMsg((m) => ({ ...m, link: '' })); }}>
                <Icon aria-hidden /><b>{label}</b><small>{hint}</small>
              </button>
            ))}
          </div>
        </Card>
        {audience && (
          <Card title="۲. فیلتر (اختیاری)" description="خالی یعنی همه‌ی حساب‌های فعالِ این گروه" padded={false}>
            <NoticeFilters audience={audience} filters={filters} onChange={patch} />
          </Card>
        )}
        {audience && (
          <Card title="۳. پیام">
            <FormGrid>
              <TextField label="عنوان" value={msg.title} maxLength={120} required hint={`${faNum(msg.title.length)} از ۱۲۰`}
                onChange={(e) => setMsg({ ...msg, title: e.target.value })} />
              <SelectField label="پیوند (با زدنِ اعلان کجا برود)" value={msg.link} options={LINKS[audience]}
                onChange={(e) => setMsg({ ...msg, link: e.target.value })} />
            </FormGrid>
            <div style={{ marginTop: 14 }}>
              <TextArea label="متن" value={msg.body} maxLength={240} rows={3} hint={`${faNum(msg.body.length)} از ۲۴۰`}
                onChange={(e) => setMsg({ ...msg, body: e.target.value })} />
            </div>
          </Card>
        )}
      </div>
      <aside className={own.side}>
        <Card title="خلاصه">
          {!audience ? <p className={own.hint}>اول گیرندگان را انتخاب کنید.</p> : (
            <>
              <div className={own.count}><b>{faNum(preview?.count ?? 0)}</b><span>نفر می‌گیرند</span></div>
              {error && <p className={own.error}>{error}</p>}
              {preview && <p className={own.hint}>{preview.label}</p>}
              {preview && preview.sample.length > 0 && <p className={own.hint}>از جمله: {preview.sample.join('، ')}</p>}
            </>
          )}
          <div className={own.mock} data-kid={audience === 'students' || undefined}>
            <HiOutlineBell aria-hidden />
            <div><b>{msg.title || 'عنوانِ اعلان'}</b><p>{msg.body || 'متنِ کوتاهِ اعلان این‌جا می‌آید.'}</p></div>
          </div>
          <Button variant="primary" icon={<HiOutlinePaperAirplane aria-hidden />} disabled={!ready} onClick={() => setConfirm(true)}>
            فرستادن
          </Button>
        </Card>
      </aside>
      <ConfirmDialog open={confirm} title="فرستادنِ اعلان" confirmLabel="بفرست" busy={sendNotice.isPending}
        message={`«${msg.title}» برای ${faNum(preview?.count ?? 0)} ${audience === 'parents' ? 'والد' : 'دانش‌آموز'} فرستاده می‌شود. پس‌گرفتنی نیست.`}
        onClose={() => setConfirm(false)} onConfirm={() => void submit()} />
    </div>
  );
}
