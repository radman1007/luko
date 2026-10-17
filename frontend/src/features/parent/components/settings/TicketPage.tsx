import { useState } from 'react';
import {
  HiOutlineCheckCircle,
  HiOutlineLockClosed,
  HiOutlinePaperAirplane,
  HiOutlinePlus,
  HiOutlineStar,
  HiStar,
} from 'react-icons/hi2';
import { LukoLogo } from '@/components/ui/LukoLogo/LukoLogo';
import type { TicketDetail } from '../../settingsTypes';
import { apiError } from '../../settingsApi';
import { useCloseTicket, useRateTicket, useReplyTicket, useTicket } from '../../useSettings';
import { fa } from '../health/moods';
import { Sheet } from '../shell/Sheet';
import { GUEST_TICKET_DETAILS } from './guestSettings';
import { useSettingsEnv } from './SettingsContext';
import form from './form.module.css';
import styles from './TicketPage.module.css';

interface Props {
  ticketId: number;
}

const RATING_TEXT = ['', 'راضی نبودم', 'می‌شد بهتر باشد', 'معمولی', 'خوب بود', 'عالی بود'];

/** یک تیکت: گفت‌وگوی کامل، پاسخ، بستن و امتیاز به پشتیبانی */
export function TicketPage({ ticketId }: Props) {
  const env = useSettingsEnv();
  const query = useTicket(ticketId, !env.guest);
  const ticket = env.guest ? GUEST_TICKET_DETAILS.find((t) => t.id === ticketId) : query.data;

  if (!ticket) {
    if (!env.guest && query.isLoading) return <div className={styles.loading} aria-hidden><i /><i /></div>;
    return (
      <div className={styles.missing}>
        <p>این تیکت پیدا نشد.</p>
        <button type="button" className={form.ghost} onClick={() => env.open('support')}>بازگشت به پشتیبانی</button>
      </div>
    );
  }
  return <TicketView ticket={ticket} />;
}

function TicketView({ ticket }: { ticket: TicketDetail }) {
  const env = useSettingsEnv();
  const reply = useReplyTicket(ticket.id);
  const close = useCloseTicket(ticket.id);
  const [body, setBody] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  const send = () => {
    if (env.guest) {
      env.onNotice('در حالتِ نمایشی پیام فرستاده نمی‌شود');
      return;
    }
    if (body.trim().length < 2) return;
    reply.mutate(body.trim(), { onSuccess: () => setBody('') });
  };

  const doClose = () => {
    setConfirmClose(false);
    if (env.guest) {
      env.onNotice('در حالتِ نمایشی تیکت بسته نمی‌شود');
      return;
    }
    close.mutate(undefined, { onSuccess: () => env.onNotice('تیکت بسته شد') });
  };

  return (
    <div className={styles.page}>
      <section className={styles.head}>
        <div className={styles.headTop}>
          <span className={styles.code} dir="ltr">{ticket.code}</span>
          <span className={styles.status} data-status={ticket.status}>{ticket.statusLabel}</span>
          {ticket.priority === 'high' && <span className={styles.priority}>اولویتِ مشترک</span>}
        </div>
        <h2>{ticket.subject}</h2>
        <dl className={styles.facts}>
          <div><dt>دسته</dt><dd>{ticket.categoryLabel}</dd></div>
          <div><dt>فرزند</dt><dd>{ticket.childName || 'عمومی'}</dd></div>
          <div><dt>ثبت</dt><dd>{ticket.createdFa}</dd></div>
          <div><dt>پیام‌ها</dt><dd>{fa(ticket.messages)}</dd></div>
        </dl>
      </section>

      <section className={styles.thread} aria-label="گفت‌وگو">
        <ol>
          {ticket.thread.map((message) => (
            <li key={message.id} data-staff={message.fromStaff || undefined}>
              {message.fromStaff && <span className={styles.staffMark} aria-hidden><LukoLogo height={11} /></span>}
              <div className={styles.bubble}>
                <span className={styles.sender}>{message.fromStaff ? 'پشتیبانیِ لوکو' : 'شما'}</span>
                <p>{message.body}</p>
                <time>{message.atFa}</time>
              </div>
            </li>
          ))}
        </ol>
        {ticket.status === 'open' && (
          <p className={styles.waiting}>پیامتان رسیده است؛ تیمِ لوکو معمولاً در کمتر از یک روزِ کاری پاسخ می‌دهد.</p>
        )}
      </section>

      {ticket.canRate && <RateCard ticket={ticket} />}
      {ticket.rating && (
        <p className={styles.rated}>
          <HiStar aria-hidden /> امتیازِ شما: {fa(ticket.rating)} از ۵، {RATING_TEXT[ticket.rating]}
          {ticket.ratingComment && <span>«{ticket.ratingComment}»</span>}
        </p>
      )}

      {ticket.canReply ? (
        <section className={styles.reply}>
          {reply.isError && <p className={form.error} role="alert">{apiError(reply.error, 'پیام فرستاده نشد؛ دوباره تلاش کنید.')}</p>}
          <label className={form.field}>
            پاسخِ شما
            <textarea value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)}
              placeholder="اگر توضیحِ بیشتری دارید یا مشکل حل نشده، همین‌جا بنویسید." />
          </label>
          <div className={form.row}>
            <button type="button" className={form.primary} disabled={reply.isPending || body.trim().length < 2} onClick={send}>
              <HiOutlinePaperAirplane aria-hidden /> {reply.isPending ? 'در حالِ ارسال…' : 'ارسالِ پاسخ'}
            </button>
            {ticket.canClose && (
              <button type="button" className={form.ghost} disabled={close.isPending} onClick={() => setConfirmClose(true)}>
                <HiOutlineCheckCircle aria-hidden /> مشکل حل شد؛ بستن
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.closed}>
          <HiOutlineLockClosed aria-hidden />
          <p>این تیکت {ticket.closedFa ? `${ticket.closedFa} ` : ''}بسته شده است. اگر موضوعِ تازه‌ای دارید، تیکتِ تازه بسازید.</p>
          <button type="button" className={form.ghost} onClick={() => env.open('newticket')}>
            <HiOutlinePlus aria-hidden /> تیکتِ تازه
          </button>
        </section>
      )}

      <Sheet open={confirmClose} title="بستنِ تیکت" onClose={() => setConfirmClose(false)}>
        <p className={styles.sheetText}>اگر پاسخ را گرفته‌اید، تیکت را ببندید. تیکتِ بسته دیگر پیام نمی‌گیرد ولی همیشه در فهرست می‌ماند.</p>
        <div className={form.row}>
          <button type="button" className={form.primary} onClick={doClose}>بله، ببند</button>
          <button type="button" className={form.ghost} onClick={() => setConfirmClose(false)}>نه هنوز</button>
        </div>
      </Sheet>
    </div>
  );
}

function RateCard({ ticket }: { ticket: TicketDetail }) {
  const env = useSettingsEnv();
  const rate = useRateTicket(ticket.id);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const submit = () => {
    if (env.guest) {
      env.onNotice('در حالتِ نمایشی امتیاز ثبت نمی‌شود');
      return;
    }
    rate.mutate({ rating: stars, comment: comment.trim() }, { onSuccess: () => env.onNotice('ممنون از نظرتان') });
  };

  return (
    <section className={styles.rate} aria-labelledby="rate-title">
      <h3 id="rate-title">پاسخِ پشتیبانی چطور بود؟</h3>
      <div className={styles.stars} role="radiogroup" aria-label="امتیاز از ۱ تا ۵">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${fa(n)}، ${RATING_TEXT[n]}`}
            data-on={n <= stars || undefined} onClick={() => setStars(n)}>
            {n <= stars ? <HiStar aria-hidden /> : <HiOutlineStar aria-hidden />}
          </button>
        ))}
        {stars > 0 && <span>{RATING_TEXT[stars]}</span>}
      </div>
      {stars > 0 && (
        <>
          <label className={form.field}>
            نظرتان (اختیاری)
            <input value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} placeholder="چه چیزی خوب بود یا بهتر می‌شد؟" />
          </label>
          {rate.isError && <p className={form.error}>{apiError(rate.error, 'ثبت نشد؛ دوباره تلاش کنید.')}</p>}
          <button type="button" className={form.primary} disabled={rate.isPending} onClick={submit}>ثبتِ امتیاز</button>
        </>
      )}
    </section>
  );
}
