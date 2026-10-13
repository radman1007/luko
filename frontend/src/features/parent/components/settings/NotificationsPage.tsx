import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineBell,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckBadge,
  HiOutlineChevronLeft,
  HiOutlineCreditCard,
  HiOutlineFaceSmile,
  HiOutlineMegaphone,
  HiOutlineMoon,
  HiOutlinePuzzlePiece,
  HiOutlineSignal,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import type { ParentNotification, ParentPreferences } from '../../types';
import { fa } from '../health/moods';
import { useSettingsEnv } from './SettingsContext';
import form from './form.module.css';
import styles from './NotificationsPage.module.css';

type Kind = ParentNotification['kind'];

const ICON: Record<Kind, ComponentType<SVGProps<SVGSVGElement>>> = {
  weekly: HiOutlineTrophy,
  games: HiOutlinePuzzlePiece,
  mood: HiOutlineFaceSmile,
  idle: HiOutlineMoon,
  assignment: HiOutlineCheckBadge,
  billing: HiOutlineCreditCard,
  announcement: HiOutlineMegaphone,
  support: HiOutlineChatBubbleLeftRight,
};

/** فیلترهای بالای فهرست؛ هر کدام چند نوعِ اعلان را می‌گیرد */
const FILTERS: { key: string; label: string; kinds?: Kind[] }[] = [
  { key: 'all', label: 'همه' },
  { key: 'learn', label: 'یادگیری', kinds: ['weekly', 'games', 'assignment', 'idle'] },
  { key: 'mood', label: 'حال و سلامت', kinds: ['mood'] },
  { key: 'account', label: 'اشتراک و پشتیبانی', kinds: ['billing', 'support', 'announcement'] },
];

const SWITCHES: { key: keyof ParentPreferences; icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; note: string }[] = [
  { key: 'weeklyReport', icon: HiOutlineBell, title: 'گزارشِ هفتگی', note: 'هر هفته خبرِ آماده‌شدنِ خلاصه‌ی پیشرفت' },
  { key: 'activityAlerts', icon: HiOutlineSignal, title: 'هشدارهای فعالیت', note: 'بازیِ کامل‌شده، ثبتِ حال و روزهای بی‌فعالیتی' },
];

/** اعلان‌ها: صندوقِ همه‌ی اعلان‌ها با فیلتر و پیوندِ اقدام، و سوییچ‌های دریافت */
export function NotificationsPage() {
  const env = useSettingsEnv();
  const [filter, setFilter] = useState('all');
  const items = env.notifications?.items ?? [];
  const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
  const shown = kinds ? items.filter((item) => kinds.includes(item.kind)) : items;
  const unread = env.notifications?.unread ?? 0;

  // دیدنِ صفحه یعنی خواندن (همان رفتارِ شیتِ قبلی)
  useEffect(() => {
    if (unread > 0 && !env.guest) env.onReadAll();
    // فقط بارِ اول
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <section className={form.card} data-area="inbox" aria-labelledby="inbox-title">
        <header className={styles.head}>
          <h3 id="inbox-title" className={form.cardTitle}>همه‌ی اعلان‌ها</h3>
          {unread > 0 && <span className={styles.unread}>{fa(unread)} تازه</span>}
        </header>
        <div className={styles.filters} role="tablist" aria-label="نوعِ اعلان">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
              data-active={filter === f.key || undefined} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className={styles.empty}>
            <HiOutlineBell aria-hidden />
            {items.length === 0 ? 'هنوز اعلانی ندارید؛ با اولین بازی‌های فرزندتان این‌جا پر می‌شود.' : 'اعلانی از این نوع نیست.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {shown.map((item) => {
              const Icon = ICON[item.kind] ?? HiOutlineBell;
              return (
                <li key={item.id} className={styles.item} data-kind={item.kind} data-unread={!item.isRead || undefined}>
                  <span className={styles.icon} aria-hidden><Icon /></span>
                  <div className={styles.main}>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                    <small>{item.at}{item.childName ? ` · ${item.childName}` : ''}</small>
                  </div>
                  {item.link && (
                    <button type="button" className={styles.go} onClick={() => env.follow(item.link as string)}
                      aria-label={`مشاهده: ${item.title}`}>
                      مشاهده <HiOutlineChevronLeft aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={form.card} data-area="prefs" aria-labelledby="prefs-title">
        <h3 id="prefs-title" className={form.cardTitle}>چه اعلان‌هایی بیاید؟</h3>
        <ul className={styles.switches}>
          {SWITCHES.map(({ key, icon: Icon, title, note }) => {
            const on = env.preferences?.[key] ?? true;
            return (
              <li key={key}>
                <span className={styles.switchIcon} aria-hidden><Icon /></span>
                <span className={styles.switchText}><b>{title}</b><small>{note}</small></span>
                <button type="button" role="switch" aria-checked={on} aria-label={title}
                  className={styles.switch} data-on={on || undefined} onClick={() => env.onToggle(key, !on)} />
              </li>
            );
          })}
        </ul>
        <p className={styles.always}>
          اعلان‌های اشتراک (رو به پایان، پرداخت) و پاسخِ پشتیبانی همیشه می‌آیند تا چیزی از دست نرود.
        </p>
      </section>
    </div>
  );
}
