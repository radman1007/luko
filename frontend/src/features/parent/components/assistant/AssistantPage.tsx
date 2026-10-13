import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineChatBubbleLeftRight,
  HiOutlineLockClosed,
  HiOutlinePaperAirplane,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { AssistantMessage, AssistantThread, AssistantTier } from '../../assistantApi';
import { apiError } from '../../settingsApi';
import type { AiTier } from '../../types';
import { useAsk, useAssistant, useClearAssistant } from '../../useAssistant';
import { GUEST_THREAD } from './guestThread';
import styles from './AssistantPage.module.css';

interface Props {
  childId?: string;
  childName: string;
  /** حالتِ نمایشی: گفت‌وگوی نمونه، بی‌ارسال */
  guest?: boolean;
  onUpgrade: () => void;
  onSupport: () => void;
  /** مهمان: رفتن به ورود */
  onLogin?: () => void;
}

const QUESTION_MAX = 800;
const fa = (n: number) => n.toLocaleString('fa-IR');

/** توضیحِ کوتاهِ هر سطح زیرِ نامش */
const TIER_NOTE: Record<AiTier, string> = {
  flash: 'سریع و رایگان',
  pro: 'تحلیلِ عمیق‌تر',
  luna: 'بهترین کیفیت',
};

/**
 * دستیارِ هوشمندِ والدین: پرسش درباره‌ی همین فرزند و پاسخی که از بازی‌ها و حال‌های خودِ او ساخته
 * می‌شود. سه مدل: «پایه» برای همه، «حرفه‌ای» و «پیشرفته» با اشتراکِ همین فرزند؛ هرکدام سهمیه‌ی روزانه دارد.
 */
export function AssistantPage({ childId, childName, guest = false, onUpgrade, onSupport, onLogin }: Props) {
  const query = useAssistant(childId, !guest);
  const thread: AssistantThread | undefined = guest ? GUEST_THREAD : query.data;
  const ask = useAsk(childId ?? '');
  const clear = useClearAssistant(childId ?? '');
  const [tier, setTier] = useState<AiTier>('flash');
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const tiers = thread?.quota.tiers ?? [];
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const premium = Boolean(thread?.quota.premium);
  const messages = thread?.messages ?? [];
  const pending = Boolean(thread?.pending) || ask.isPending;

  // فرزندِ دیگر: اگر مدلِ انتخاب‌شده برای او قفل است، به «پایه» برگرد
  useEffect(() => {
    if (active?.locked) setTier('flash');
  }, [active?.locked, childId]);

  // پیامِ تازه → پایینِ گفت‌وگو
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';

  const send = (text: string, useTier: AiTier = tier) => {
    const clean = text.trim();
    if (!clean || guest || pending || !childId) return;
    ask.mutate({ text: clean, tier: useTier }, { onSuccess: () => setDraft('') });
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // روی لپ‌تاپ Enter می‌فرستد و Shift+Enter خطِ تازه است؛ روی گوشی کیبورد خودش خطِ تازه می‌زند
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      send(draft);
    }
  };

  if (!guest && query.isLoading) {
    return <div className={styles.loading} aria-hidden><i /><i /></div>;
  }
  if (!guest && (query.isError || !thread)) {
    return (
      <div className={styles.state}>
        <p>دستیار بارگذاری نشد. اتصال را بررسی کنید.</p>
        <button type="button" className={styles.ghostBtn} onClick={() => void query.refetch()}>تلاشِ دوباره</button>
      </div>
    );
  }
  if (!thread) return null;

  const outOfQuota = Boolean(active && !active.locked && active.left <= 0);
  const canSend = !guest && thread.enabled && !pending && !outOfQuota && draft.trim().length > 1;

  return (
    <div className={styles.page}>
      <aside className={styles.side}>
        <section className={styles.hero}>
          <img src={LUKORIANS.luko.image} alt="" aria-hidden className={styles.avatar} loading="lazy" decoding="async" />
          <div>
            <h2>دستیارِ هوشمندِ لوکو</h2>
            <p>
              هر سؤالی درباره‌ی یادگیری، عادت‌ها و حالِ {childName} دارید بپرسید. پاسخ از بازی‌ها و حال‌هایی ساخته
              می‌شود که خودِ {childName} در لوکو ثبت کرده، نه توصیه‌ی کلی.
            </p>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="ai-models">
          <h3 id="ai-models">مدلِ پاسخ‌گو</h3>
          <div className={styles.tiers} role="radiogroup" aria-label="انتخابِ مدل">
            {tiers.map((item) => (
              <TierOption key={item.key} item={item} selected={item.key === active?.key}
                onSelect={() => (item.locked ? onUpgrade() : setTier(item.key))} />
            ))}
          </div>
          {!premium && (
            <button type="button" className={styles.upsell} onClick={onUpgrade}>
              <CrownIcon size={18} strokeWidth={2} aria-hidden />
              <span>
                <b>مدل‌های حرفه‌ای و پیشرفته با اشتراکِ {childName}</b>
                <small>
                  روزانه تا {fa(thread.quota.premiumLimits.flash)} پرسشِ پایه، {fa(thread.quota.premiumLimits.pro)} پرسشِ
                  حرفه‌ای و {fa(thread.quota.premiumLimits.luna)} پرسشِ پیشرفته
                </small>
              </span>
            </button>
          )}
        </section>

        <section className={styles.notes}>
          <p><HiOutlineShieldCheck aria-hidden /> نامِ {childName} و شماره‌ها برای مدل فرستاده نمی‌شود؛ فقط عددهای گزارش.</p>
          <p><HiOutlineSparkles aria-hidden /> دستیار جای مشاوره‌ی پزشک، روان‌شناس یا معلم را نمی‌گیرد.</p>
        </section>
      </aside>

      <section className={styles.chat} aria-label={`گفت‌وگو درباره‌ی ${childName}`}>
        <header className={styles.chatHead}>
          <div>
            <h3>گفت‌وگو درباره‌ی {childName}</h3>
            <small>{active ? `مدلِ ${active.label} · ${active.name}` : ''}</small>
          </div>
          {messages.length > 0 && !guest && (
            confirmClear ? (
              <span className={styles.confirm}>
                پاک شود؟
                <button type="button" onClick={() => { clear.mutate(); setConfirmClear(false); }}>بله</button>
                <button type="button" onClick={() => setConfirmClear(false)}>نه</button>
              </span>
            ) : (
              <button type="button" className={styles.iconBtn} onClick={() => setConfirmClear(true)} disabled={pending}
                aria-label="پاک کردنِ گفت‌وگو">
                <HiOutlineTrash aria-hidden />
              </button>
            )
          )}
        </header>

        <div ref={listRef} className={styles.messages} aria-live="polite">
          {messages.length === 0 && !ask.isPending ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden><HiOutlineChatBubbleLeftRight /></span>
              <b>از من بپرسید</b>
              <p>چند پرسشِ پیشنهادی از روی گزارشِ این هفته‌ی {childName}:</p>
            </div>
          ) : (
            messages.map((message) => (
              <Bubble key={message.id} message={message} childName={childName}
                onRetry={message.status === 'failed' && lastQuestion
                  ? () => send(lastQuestion, (message.tier || 'flash') as AiTier) : undefined} />
            ))
          )}
          {/* تا سرور پرسش را ثبت کند، همان را نشان می‌دهیم */}
          {ask.isPending && ask.variables && (
            <>
              <div className={styles.row} data-role="user">
                <div className={styles.bubble}><p>{ask.variables.text}</p></div>
              </div>
              <div className={styles.row} data-role="assistant">
                <span className={styles.typing} aria-label="در حالِ نوشتن"><i /><i /><i /></span>
              </div>
            </>
          )}
        </div>

        {!pending && !outOfQuota && thread.enabled && thread.suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {thread.suggestions.map((text) => (
              <button key={text} type="button" disabled={guest || pending || outOfQuota || !thread.enabled}
                onClick={() => send(text)}>
                {text}
              </button>
            ))}
          </div>
        )}

        {guest ? (
          <div className={styles.locked}>
            <HiOutlineLockClosed aria-hidden />
            <span>در حالتِ نمایشی پرسیدن فعال نیست. با شماره‌ی خودتان وارد شوید تا درباره‌ی فرزندتان بپرسید.</span>
            {onLogin && <button type="button" className={styles.primaryBtn} onClick={onLogin}>ورود به پنل</button>}
          </div>
        ) : !thread.enabled ? (
          <div className={styles.locked}>
            <HiOutlineSparkles aria-hidden />
            <span>دستیار به‌زودی فعال می‌شود. تا آن موقع پشتیبانیِ لوکو کنارِ شماست.</span>
            <button type="button" className={styles.ghostBtn} onClick={onSupport}>گفتگو با پشتیبانی</button>
          </div>
        ) : outOfQuota ? (
          <div className={styles.locked}>
            <CrownIcon size={20} strokeWidth={2} aria-hidden />
            <span>
              سهمیه‌ی امروزِ مدلِ {active?.label} تمام شد.{' '}
              {premium ? 'فردا دوباره می‌توانید بپرسید یا مدلِ دیگری انتخاب کنید.' : 'با اشتراک، پرسش‌های بیشتر و مدل‌های بهتر باز می‌شود.'}
            </span>
            {!premium && <button type="button" className={styles.primaryBtn} onClick={onUpgrade}>دیدنِ اشتراک</button>}
          </div>
        ) : (
          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            {ask.isError && <p className={styles.error} role="alert">{apiError(ask.error, 'پرسش فرستاده نشد؛ دوباره تلاش کنید.')}</p>}
            <div className={styles.inputRow}>
              <textarea value={draft} maxLength={QUESTION_MAX} rows={1} onKeyDown={onKey}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`پرسشتان را درباره‌ی ${childName} بنویسید…`} aria-label="پرسش" />
              <button type="submit" className={styles.send} disabled={!canSend} aria-label="فرستادن">
                <HiOutlinePaperAirplane aria-hidden />
              </button>
            </div>
            {active && (
              <small className={styles.quota}>
                {fa(active.left)} پرسش از {fa(active.limit)} پرسشِ امروزِ مدلِ {active.label} مانده
              </small>
            )}
          </form>
        )}
      </section>
    </div>
  );
}

function TierOption({ item, selected, onSelect }: { item: AssistantTier; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={styles.tier} data-tier={item.key}
      aria-label={`مدلِ ${item.label} (${item.name})، ${item.locked ? 'با اشتراک باز می‌شود' : `${fa(item.left)} پرسش از ${fa(item.limit)} پرسشِ امروز مانده`}`}
      data-selected={selected || undefined} data-locked={item.locked || undefined} onClick={onSelect}>
      <span className={styles.tierTop}>
        <b>{item.label}</b>
        {item.locked ? (
          <em className={styles.lockChip}><CrownIcon size={12} strokeWidth={2.2} aria-hidden /> با اشتراک</em>
        ) : (
          <em className={styles.leftChip}>{fa(item.left)} از {fa(item.limit)}</em>
        )}
      </span>
      <small dir="ltr" className={styles.modelName}>{item.name}</small>
      <small>{TIER_NOTE[item.key]}</small>
    </button>
  );
}

/** متنِ پاسخ: بندها و فهرستِ «• » — بی‌HTML، فقط متن */
function RichText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const list = line.startsWith('• ');
    const last = blocks[blocks.length - 1];
    const value = list ? line.slice(2) : line;
    if (last && last.list === list && list) last.lines.push(value);
    else blocks.push({ list, lines: [value] });
  }
  return (
    <>
      {blocks.map((block, index) => (block.list ? (
        <ul key={index}>{block.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
      ) : (
        block.lines.map((line, i) => <p key={`${index}-${i}`}>{line}</p>)
      )))}
    </>
  );
}

function Bubble({ message, childName, onRetry }: { message: AssistantMessage; childName: string; onRetry?: () => void }) {
  if (message.role === 'user') {
    return (
      <div className={styles.row} data-role="user">
        <div className={styles.bubble}><p>{message.content}</p><time>{message.atFa}</time></div>
      </div>
    );
  }
  if (message.status === 'pending') {
    return (
      <div className={styles.row} data-role="assistant">
        <span className={styles.typing} aria-label="در حالِ نوشتن"><i /><i /><i /></span>
        <small className={styles.thinking}>
          {message.tier === 'pro' ? 'مدلِ حرفه‌ای با دقت فکر می‌کند؛ کمی بیشتر طول می‌کشد…' : `در حالِ نوشتنِ پاسخ درباره‌ی ${childName}…`}
        </small>
      </div>
    );
  }
  return (
    <div className={styles.row} data-role="assistant" data-failed={message.status === 'failed' || undefined}>
      <div className={styles.bubble}>
        <RichText text={message.content} />
        <footer>
          <time>{message.atFa}</time>
          {message.status === 'done' && message.tierLabel && <span>مدلِ {message.tierLabel}</span>}
          {onRetry && (
            <button type="button" onClick={onRetry}><HiOutlineArrowPath aria-hidden /> دوباره بپرس</button>
          )}
        </footer>
      </div>
    </div>
  );
}
