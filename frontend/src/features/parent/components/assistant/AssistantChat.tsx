import { useEffect, useRef, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineChatBubbleLeftRight,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { useCoverGoftino } from '@/features/support/useCoverGoftino';
import type { AssistantMessage, AssistantThread, AssistantTier } from '../../assistantApi';
import type { AiTier } from '../../types';
import { Composer } from './Composer';
import { fa } from './look';
import styles from './AssistantChat.module.css';

interface Props {
  thread: AssistantThread;
  childName: string;
  guest: boolean;
  tier: AiTier;
  onTier: (tier: AiTier) => void;
  draft: string;
  onDraft: (value: string) => void;
  onAsk: (text: string, tier?: AiTier) => void;
  /** پرسشی که هنوز ثبت نشده (تا سرور پاسخ دهد همان نشان داده می‌شود) */
  sending: string | null;
  error: string;
  pending: boolean;
  onClear: () => void;
  clearing: boolean;
  onUpgrade: () => void;
  onSupport: () => void;
  onLogin?: () => void;
}

/** توضیحِ کوتاهِ هر سطح زیرِ نامش */
const TIER_NOTE: Record<AiTier, string> = {
  flash: 'سریع و رایگان',
  pro: 'تحلیلِ عمیق‌تر',
  luna: 'بهترین کیفیت',
};

/**
 * گفت‌وگو با دستیار درباره‌ی یک فرزند. سه مدل: «پایه» برای همه، «حرفه‌ای» و «پیشرفته» با اشتراکِ همین فرزند؛
 * هرکدام سهمیه‌ی روزانه دارد. پاسخ در صفِ سرور ساخته می‌شود و صفحه تا رسیدنش گفت‌وگو را دوباره می‌خواند.
 */
export function AssistantChat({
  thread, childName, guest, tier, onTier, draft, onDraft, onAsk, sending, error, pending, onClear, clearing,
  onUpgrade, onSupport, onLogin,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // حبابِ پشتیبانی روی کادرِ پرسش می‌افتاد و دو گفت‌وگوی شناور کنارِ هم گیج‌کننده است؛ پشتیبانی در منو هست
  useCoverGoftino(true);
  const tiers = thread.quota.tiers;
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const premium = thread.quota.premium;
  const messages = thread.messages;

  // پیامِ تازه → پایینِ گفت‌وگو
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, sending]);

  const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const outOfQuota = Boolean(active && !active.locked && active.left <= 0);
  const canSend = !guest && thread.enabled && !pending && !outOfQuota;

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <aside className={styles.side}>
          <section className={styles.card} aria-labelledby="ai-models">
            <h3 id="ai-models">مدلِ پاسخ‌گو</h3>
            <div className={styles.tiers} role="radiogroup" aria-label="انتخابِ مدل">
              {tiers.map((item) => (
                <TierOption key={item.key} item={item} selected={item.key === active?.key}
                  onSelect={() => (item.locked ? onUpgrade() : onTier(item.key))} />
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
                  <button type="button" onClick={() => { onClear(); setConfirmClear(false); }}>بله</button>
                  <button type="button" onClick={() => setConfirmClear(false)}>نه</button>
                </span>
              ) : (
                <button type="button" className={styles.iconBtn} onClick={() => setConfirmClear(true)}
                  disabled={pending || clearing} aria-label="پاک کردنِ گفت‌وگو">
                  <HiOutlineTrash aria-hidden />
                </button>
              )
            )}
          </header>

          <div ref={listRef} className={styles.messages} aria-live="polite">
            {messages.length === 0 && !sending ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon} aria-hidden><HiOutlineChatBubbleLeftRight /></span>
                <b>از من بپرسید</b>
                <p>چند پرسشِ پیشنهادی از روی گزارشِ این هفته‌ی {childName}:</p>
              </div>
            ) : (
              messages.map((message) => (
                <Bubble key={message.id} message={message} childName={childName}
                  onRetry={message.status === 'failed' && lastQuestion && canSend
                    ? () => onAsk(lastQuestion, (message.tier || 'flash') as AiTier) : undefined} />
              ))
            )}
            {sending && (
              <>
                <div className={styles.row} data-role="user">
                  <div className={styles.bubble}><p>{sending}</p></div>
                </div>
                <div className={styles.row} data-role="assistant">
                  <span className={styles.typing} aria-label="در حالِ نوشتن"><i /><i /><i /></span>
                </div>
              </>
            )}
          </div>

          {canSend && thread.suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {thread.suggestions.map((text) => (
                <button key={text} type="button" onClick={() => onAsk(text)}>{text}</button>
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
            <div className={styles.composer}>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Composer value={draft} onChange={onDraft} onSend={() => onAsk(draft)}
                canSend={canSend && draft.trim().length > 1} disabled={pending}
                placeholder={`پرسشتان را درباره‌ی ${childName} بنویسید…`} />
              {active && (
                <small className={styles.quota}>
                  {fa(active.left)} پرسش از {fa(active.limit)} پرسشِ امروزِ مدلِ {active.label} مانده
                </small>
              )}
            </div>
          )}
        </section>
      </div>
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
