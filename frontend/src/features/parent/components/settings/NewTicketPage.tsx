import { useState } from 'react';
import {
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineCreditCard,
  HiOutlineEllipsisHorizontalCircle,
  HiOutlineLightBulb,
  HiOutlinePaperAirplane,
  HiOutlinePuzzlePiece,
  HiOutlineUserCircle,
  HiOutlineWrenchScrewdriver,
} from 'react-icons/hi2';
import type { ComponentType, SVGProps } from 'react';
import type { TicketCategory } from '../../settingsTypes';
import { apiError } from '../../settingsApi';
import { useCreateTicket } from '../../useSettings';
import { fa } from '../health/moods';
import { childName, useSettingsEnv } from './SettingsContext';
import form from './form.module.css';
import styles from './NewTicketPage.module.css';

const CATEGORIES: { key: TicketCategory; label: string; hint: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: 'billing', label: 'اشتراک و پرداخت', hint: 'خرید، تمدید، صورت‌حساب', icon: HiOutlineCreditCard },
  { key: 'account', label: 'حساب و ورود', hint: 'رمز، شماره، پایه', icon: HiOutlineUserCircle },
  { key: 'reports', label: 'گزارش‌ها و پنل', hint: 'عددها، سلامت، اعلان‌ها', icon: HiOutlineChartBar },
  { key: 'games', label: 'بازی‌ها و محتوا', hint: 'بازی، پادکست، ویدیو', icon: HiOutlinePuzzlePiece },
  { key: 'technical', label: 'مشکلِ فنی', hint: 'باز نشدن، کندی، خطا', icon: HiOutlineWrenchScrewdriver },
  { key: 'idea', label: 'پیشنهاد و انتقاد', hint: 'چیزی که دوست دارید باشد', icon: HiOutlineLightBulb },
  { key: 'other', label: 'سایر', hint: 'هر چیزِ دیگر', icon: HiOutlineEllipsisHorizontalCircle },
];

const MAX_BODY = 4000;

/** فرمِ تیکتِ تازه: دسته، فرزندِ مربوط، موضوع و شرحِ کامل */
export function NewTicketPage() {
  const env = useSettingsEnv();
  const create = useCreateTicket();
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [child, setChild] = useState<string | null>(env.childList.length === 1 ? env.childList[0].id : null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tried, setTried] = useState(false);

  const subjectOk = subject.trim().length >= 4;
  const bodyOk = body.trim().length >= 10;
  const ready = Boolean(category) && subjectOk && bodyOk;

  const submit = () => {
    setTried(true);
    if (!ready || !category) return;
    if (env.guest) {
      env.onNotice('در حالتِ نمایشی تیکت فرستاده نمی‌شود');
      return;
    }
    create.mutate(
      { category, childId: child, subject: subject.trim(), body: body.trim() },
      {
        onSuccess: (ticket) => {
          env.onNotice(`تیکتِ ${ticket.code} ثبت شد؛ پاسخ همین‌جا و در اعلان‌ها می‌آید`);
          env.open('ticket', String(ticket.id));
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      <section className={form.card}>
        <h3 className={form.cardTitle}>۱. موضوع درباره‌ی چیست؟</h3>
        <div className={styles.categories} role="radiogroup" aria-label="دسته‌ی تیکت">
          {CATEGORIES.map(({ key, label, hint, icon: Icon }) => (
            <button key={key} type="button" role="radio" aria-checked={category === key} aria-label={`${label} — ${hint}`}
              data-active={category === key || undefined} onClick={() => setCategory(key)}>
              <Icon aria-hidden />
              <span><b>{label}</b><small>{hint}</small></span>
            </button>
          ))}
        </div>
        {tried && !category && <p className={form.error}>یک دسته انتخاب کنید.</p>}
      </section>

      {env.childList.length > 0 && (
        <section className={form.card}>
          <h3 className={form.cardTitle}>۲. درباره‌ی کدام فرزند؟</h3>
          <div className={styles.children} role="radiogroup" aria-label="فرزندِ مربوط">
            <button type="button" role="radio" aria-checked={child === null} data-active={child === null || undefined}
              onClick={() => setChild(null)}>
              <HiOutlineAcademicCap aria-hidden /> همه / عمومی
            </button>
            {env.childList.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={child === item.id}
                data-active={child === item.id || undefined} onClick={() => setChild(item.id)}>
                <i aria-hidden>{childName(item).charAt(0)}</i> {childName(item)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={form.card}>
        <h3 className={form.cardTitle}>{env.childList.length > 0 ? '۳.' : '۲.'} شرحِ درخواست</h3>
        {create.isError && <p className={form.error} role="alert">{apiError(create.error, 'ثبتِ تیکت انجام نشد؛ دوباره تلاش کنید.')}</p>}
        <label className={form.field} data-invalid={(tried && !subjectOk) || undefined}>
          موضوع
          <input value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)}
            placeholder="مثلاً: پرداخت انجام شد ولی اشتراک فعال نشد" />
        </label>
        <label className={form.field} data-invalid={(tried && !bodyOk) || undefined}>
          توضیح
          <textarea value={body} maxLength={MAX_BODY} onChange={(e) => setBody(e.target.value)}
            placeholder="هرچه دقیق‌تر بنویسید، سریع‌تر و درست‌تر پاسخ می‌گیرید: چه شد، کِی، و چه انتظاری داشتید." />
          <span className={form.hint}>
            <span>{tried && !bodyOk ? 'دست‌کم ۱۰ نویسه بنویسید.' : 'شماره‌ی پیگیریِ پرداخت یا نامِ بازی را هم بنویسید.'}</span>
            <span>{fa(body.length)} / {fa(MAX_BODY)}</span>
          </span>
        </label>
        <button type="button" className={form.primary} disabled={create.isPending} onClick={submit}>
          <HiOutlinePaperAirplane aria-hidden />
          {create.isPending ? 'در حالِ ارسال…' : 'ثبت و ارسالِ تیکت'}
        </button>
        <p className={styles.after}>بعد از ثبت، شماره‌ی پیگیری می‌گیرید و پاسخِ تیم هم در همین صفحه و هم در اعلان‌ها می‌آید.</p>
      </section>
    </div>
  );
}
