import { useState } from 'react';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineChatBubbleOvalLeftEllipsis,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlinePlus,
  HiOutlineQuestionMarkCircle,
  HiOutlineTicket,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { openGoftino } from '@/features/support/goftino';
import { useGoftinoReady } from '@/features/support/useGoftinoReady';
import type { TicketStatus, TicketSummary } from '../../settingsTypes';
import { useTicketList } from '../../useSettings';
import { fa } from '../health/moods';
import { GUEST_TICKETS } from './guestSettings';
import { useSettingsEnv } from './SettingsContext';
import form from './form.module.css';
import styles from './SupportPage.module.css';

const TABS: { key: TicketStatus | ''; label: string }[] = [
  { key: '', label: 'همه' },
  { key: 'open', label: 'در انتظارِ پاسخ' },
  { key: 'answered', label: 'پاسخ داده شده' },
  { key: 'closed', label: 'بسته' },
];

/** پاسخ به پرسش‌های پرتکرار پیش از تیکت — بیشترِ سؤال‌ها همین‌هاست */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'فرزندم رمزش را فراموش کرده، چه کنم؟',
    a: 'در «تنظیمات ← حریم خصوصی و امنیت» یا صفحه‌ی همان فرزند، رمزش را می‌بینید یا رمزِ تازه می‌گذارید. پنلِ بچه عمداً «فراموشیِ رمز» ندارد.',
  },
  {
    q: 'اشتراک برای همه‌ی فرزندانم است؟',
    a: 'نه؛ اشتراکِ لوکو برای هر فرزند جداست. در «اشتراک و پرداخت‌ها» فرزند را انتخاب کنید و پلنش را بخرید یا تمدید کنید.',
  },
  {
    q: 'پرداخت کردم ولی اشتراک فعال نشد.',
    a: 'معمولاً تا یک دقیقه فعال می‌شود. اگر نشد، صورت‌حساب را در «اشتراک و پرداخت‌ها» ببینید و با دسته‌ی «اشتراک و پرداخت» تیکت بزنید؛ شماره‌ی پیگیری را هم بنویسید.',
  },
  {
    q: 'گزارش‌ها از کجا ساخته می‌شوند؟',
    a: 'فقط از بازی‌ها و حال‌هایی که فرزندتان خودش در لوکو انجام داده؛ هیچ عددی حدسی نیست. نوشته‌های «صندوقچه‌ی رازها» رمزنگاری شده‌اند و برای هیچ‌کس دیده نمی‌شوند.',
  },
  {
    q: 'پایه‌ی فرزندم را چطور عوض کنم؟',
    a: 'مسیرِ بازی‌ها به پایه بسته است، برای همین با تیکتِ دسته‌ی «حساب و ورود» از ما بخواهید تا با حفظِ پیشرفتش عوض کنیم.',
  },
];

/** پشتیبانی: پرسش‌های پرتکرار، گفتگوی آنلاین، تیکتِ تازه و فهرستِ تیکت‌ها */
export function SupportPage() {
  const env = useSettingsEnv();
  const [tab, setTab] = useState<TicketStatus | ''>('');
  const query = useTicketList(tab || undefined, !env.guest);
  const liveChat = useGoftinoReady();
  const data = env.guest ? GUEST_TICKETS : query.data;
  const items = env.guest ? GUEST_TICKETS.items.filter((t) => !tab || t.status === tab) : (query.data?.items ?? []);
  const counts = data?.counts;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h2>چطور کمکتان کنیم؟</h2>
          <p>تیکت بزنید تا پاسخِ دقیق و ماندگار بگیرید، یا برای سؤالِ کوتاه با ما گفتگو کنید.</p>
          {data?.priority ? (
            <span className={styles.priority} data-on><CrownIcon size={14} strokeWidth={2.2} aria-hidden /> تیکت‌های شما در اولویتِ پاسخ‌اند</span>
          ) : (
            <button type="button" className={styles.priority} onClick={() => env.open('billing')}>
              <CrownIcon size={14} strokeWidth={2.2} aria-hidden /> مشترکان زودتر پاسخ می‌گیرند
            </button>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={form.primary} onClick={() => env.open('newticket')}>
            <HiOutlinePlus aria-hidden /> تیکتِ تازه
          </button>
          {liveChat && (
            <button type="button" className={form.ghost} onClick={openGoftino}>
              <HiOutlineChatBubbleOvalLeftEllipsis aria-hidden /> گفتگوی آنلاین
            </button>
          )}
        </div>
      </section>

      <section className={form.card} data-area="tickets" aria-labelledby="tickets-title">
        <header className={styles.head}>
          <HiOutlineTicket aria-hidden />
          <h3 id="tickets-title" className={form.cardTitle}>تیکت‌های شما</h3>
          {(data?.unread ?? 0) > 0 && <span className={styles.unreadPill}>{fa(data?.unread ?? 0)} پاسخِ تازه</span>}
        </header>
        <div className={styles.tabs} role="tablist" aria-label="وضعیتِ تیکت‌ها">
          {TABS.map((item) => {
            const n = !counts ? undefined : item.key ? counts[item.key] : counts.all;
            return (
              <button key={item.key || 'all'} type="button" role="tab" aria-selected={tab === item.key}
                data-active={tab === item.key || undefined} onClick={() => setTab(item.key)}>
                {item.label}{n !== undefined && <em>{fa(n)}</em>}
              </button>
            );
          })}
        </div>

        {!env.guest && query.isLoading ? (
          <div className={styles.loading} aria-hidden><i /><i /></div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <HiOutlineChatBubbleLeftRight aria-hidden />
            <p>{tab ? 'تیکتی در این وضعیت نیست.' : 'هنوز تیکتی نزده‌اید. هر سؤالی دارید، تیمِ لوکو کنارتان است.'}</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => env.open('ticket', String(ticket.id))} />)}
          </ul>
        )}
      </section>

      <section className={form.card} data-area="faq" aria-labelledby="faq-title">
        <header className={styles.head}>
          <HiOutlineQuestionMarkCircle aria-hidden />
          <h3 id="faq-title" className={form.cardTitle}>پرسش‌های پرتکرار</h3>
        </header>
        <Faq />
      </section>
    </div>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: TicketSummary; onOpen: () => void }) {
  return (
    <li>
      <button type="button" className={styles.ticket} data-unread={ticket.unread > 0 || undefined} onClick={onOpen}>
        <span className={styles.ticketTop}>
          <b>{ticket.subject}</b>
          <span className={styles.status} data-status={ticket.status}>{ticket.statusLabel}</span>
        </span>
        <span className={styles.meta}>
          <span dir="ltr">{ticket.code}</span>
          <i aria-hidden />
          {ticket.categoryLabel}
          {ticket.childName && <><i aria-hidden />{ticket.childName}</>}
          <i aria-hidden />
          {ticket.lastFa}
        </span>
        {ticket.preview && (
          <span className={styles.preview}>
            {ticket.lastFromStaff && <em>پشتیبانی:</em>} {ticket.preview}
          </span>
        )}
        {ticket.unread > 0 && <span className={styles.dot} aria-label={`${fa(ticket.unread)} پاسخِ تازه`} />}
        <HiOutlineChevronLeft className={styles.chev} aria-hidden />
      </button>
    </li>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className={styles.faq}>
      {FAQ.map((item, i) => {
        const on = open === i;
        return (
          <li key={item.q} data-open={on || undefined}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)}>
              {item.q}
              <HiOutlineChevronDown aria-hidden />
            </button>
            {on && <p>{item.a}</p>}
          </li>
        );
      })}
    </ul>
  );
}
