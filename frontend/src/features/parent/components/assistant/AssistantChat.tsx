import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheck,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LukoLogo } from '@/components/ui/LukoLogo/LukoLogo';
import type { AssistantMessage, AssistantThread, AssistantTier, ConversationList } from '../../assistantApi';
import type { AiTier, Child } from '../../types';
import { RichText } from '../ai/RichText';
import { Sheet } from '../shell/Sheet';
import { Composer } from './Composer';
import styles from './AssistantChat.module.css';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Props {
  thread: AssistantThread;
  childName: string;
  childList: Child[];
  activeChildId?: string;
  onChildChange?: (id: string) => void;
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
  /** گفت‌وگوی تازه (خالی) */
  onNewChat: () => void;
  /** تاریخچه: فهرست وقتی برگه باز شد خوانده می‌شود */
  history?: ConversationList;
  historyLoading: boolean;
  onOpenHistory: () => void;
  onPickConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onUpgrade: () => void;
  onSupport: () => void;
  onLogin?: () => void;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

/** نشانِ هر سطح (به‌جای ایموجیِ ⚡ 🧡 ✨ در خواستِ کاربر — قاعده‌ی برند: فقط SVG) */
const TIER_LOOK: Record<AiTier, { icon: Icon; tone: string }> = {
  flash: { icon: HiOutlineBolt, tone: 'flash' },
  luna: { icon: HiOutlineHeart, tone: 'luna' },
  pro: { icon: HiOutlineSparkles, tone: 'pro' },
};

/**
 * دستیارِ هوشمندِ والدین: گفت‌وگو درباره‌ی یک فرزند، با پاسخی که از بازی‌ها و حال‌های خودِ او ساخته می‌شود.
 * سه سطح: «لوکو سریع» برای همه، «لوکو همراه» و «لوکو بینش» با اشتراکِ همین فرزند؛ هرکدام سهمیه‌ی هفتگی دارد.
 * «گفت‌وگوی تازه» یکی دیگر می‌سازد؛ تاریخچه‌ی گفت‌وگوها ویژه‌ی اشتراک است.
 * پاسخ در صفِ سرور ساخته می‌شود و صفحه تا رسیدنش گفت‌وگو را دوباره می‌خواند.
 */
export function AssistantChat(props: Props) {
  const {
    thread, childName, childList, activeChildId, onChildChange, guest, tier, onTier, draft, onDraft, onAsk, sending,
    error, pending, onClear, clearing, onNewChat, history, historyLoading, onOpenHistory, onPickConversation,
    onDeleteConversation, onUpgrade, onSupport, onLogin,
  } = props;
  const [tierSheet, setTierSheet] = useState(false);
  const [historySheet, setHistorySheet] = useState(false);
  const [childMenu, setChildMenu] = useState(false);
  const scrolled = useRef(false);
  const tiers = thread.quota.tiers;
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const premium = thread.quota.premium;
  const messages = thread.messages;
  const empty = messages.length === 0 && !sending;
  const limit = thread.questionMax || 1000;

  // پیامِ تازه → تهِ صفحه (صفحه خودش اسکرول می‌خورد). scrollIntoView پیامِ آخر را زیرِ کادرِ چسبانِ پرسش می‌بُرد؛
  // بارِ اول بی‌انیمیشن تا گفت‌وگوی قبلی از همان پیامِ آخر باز شود
  useEffect(() => {
    if (empty) return;
    const behavior: ScrollBehavior = scrolled.current ? 'smooth' : 'auto';
    scrolled.current = true;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, pending, sending, empty]);

  const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const outOfQuota = Boolean(active && !active.locked && active.left <= 0);
  const canSend = !guest && thread.enabled && !pending && !outOfQuota;
  const ActiveIcon = active ? TIER_LOOK[active.key].icon : HiOutlineBolt;
  const over = draft.length > limit;

  let strip: ReactNode = null;
  if (guest) {
    strip = (
      <Strip icon={HiOutlineLockClosed} text="در حالتِ نمایشی پرسیدن فعال نیست؛ با شماره‌ی خودتان وارد شوید."
        action={onLogin ? { label: 'ورود', onClick: onLogin } : undefined} />
    );
  } else if (!thread.enabled) {
    strip = <Strip icon={HiOutlineSparkles} text="دستیار به‌زودی فعال می‌شود." action={{ label: 'پشتیبانی', onClick: onSupport }} />;
  } else if (outOfQuota) {
    strip = (
      <Strip icon={CrownIcon as Icon}
        text={premium ? `سهمیه‌ی این هفته‌ی «${active?.label}» تمام شد؛ از شنبه دوباره پر می‌شود.`
          : 'پیام‌های رایگانِ این هفته تمام شد؛ از شنبه دوباره پر می‌شود.'}
        action={premium ? undefined : { label: 'اشتراک', onClick: onUpgrade }} gold />
    );
  } else if (over) {
    strip = <Strip icon={HiOutlineExclamationCircle} text={`هر پیام حداکثر ${fa(limit)} نویسه باشد.`} danger />;
  } else if (error) {
    strip = <Strip icon={HiOutlineExclamationCircle} text={error} danger />;
  }

  const openHistory = () => {
    setHistorySheet(true);
    if (!thread.history.locked) onOpenHistory();
  };

  return (
    <div className={styles.page}>
      {/* ---------- نوارِ بالا ---------- */}
      <header className={styles.bar}>
        <span className={styles.brandAvatar} aria-hidden><LukoLogo height={15} /></span>
        <b className={styles.brand}>دستیار لوکو</b>
        <div className={styles.barEnd}>
          {!guest && (
            <>
              <button type="button" className={styles.iconButton} onClick={onNewChat} disabled={pending}
                aria-label="گفت‌وگوی تازه" title="گفت‌وگوی تازه">
                <HiOutlinePencilSquare aria-hidden />
              </button>
              <button type="button" className={styles.iconButton} onClick={openHistory}
                aria-label="تاریخچه‌ی گفت‌وگوها" title="تاریخچه‌ی گفت‌وگوها">
                <HiOutlineClock aria-hidden />
                {thread.history.locked && <i aria-hidden><HiOutlineLockClosed /></i>}
              </button>
            </>
          )}
          <div className={styles.childWrap}>
            <button type="button" className={styles.childPill} aria-haspopup="menu" aria-expanded={childMenu}
              onClick={() => setChildMenu(!childMenu)}>
              <span className={styles.childAvatar} aria-hidden>{childName.charAt(0)}</span>
              <span className={styles.childName}>{childName}</span>
              <HiOutlineChevronDown aria-hidden />
            </button>
            {childMenu && (
              <>
                <button type="button" className={styles.menuBackdrop} aria-label="بستن" onClick={() => setChildMenu(false)} />
                <div className={styles.menu} role="menu">
                  {childList.map((child) => (
                    <button key={child.id} type="button" role="menuitemradio" aria-checked={child.id === activeChildId}
                      onClick={() => { onChildChange?.(child.id); setChildMenu(false); }}>
                      <span className={styles.childAvatar} aria-hidden>{(child.firstName || '؟').charAt(0)}</span>
                      <span>{`${child.firstName} ${child.lastName}`.trim() || 'فرزند'}</span>
                      {child.id === activeChildId && <HiOutlineCheck aria-hidden />}
                    </button>
                  ))}
                  {messages.length > 0 && !guest && (
                    <button type="button" role="menuitem" className={styles.menuDanger} disabled={pending || clearing}
                      onClick={() => { onClear(); setChildMenu(false); }}>
                      <HiOutlineTrash aria-hidden /> پاک کردنِ این گفت‌وگو
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- گفت‌وگو ---------- */}
      <div className={styles.thread} aria-live="polite">
        {empty ? (
          <div className={styles.empty}>
            <span className={styles.mascot} aria-hidden><LukoLogo height={34} /></span>
            <h2>سلام! درباره‌ی {childName} بپرس</h2>
            <p>به داده‌های آموزشیِ این هفته‌اش وصلم — بر اساسِ عددهای واقعی جواب می‌دهم.</p>
            <div className={styles.suggestions}>
              {thread.suggestions.slice(0, 3).map((text) => (
                <button key={text} type="button" disabled={!canSend && !guest} onClick={() => onAsk(text)}>
                  <span>{text}</span>
                  <HiOutlineChevronLeft aria-hidden />
                </button>
              ))}
            </div>
            {active && !guest && thread.enabled && (
              <p className={styles.quotaNote}>
                {premium
                  ? `این هفته ${fa(active.left)} پیام با «${active.label}» مانده`
                  : `هر هفته ${fa(thread.quota.freeLimit)} پیامِ رایگان با «${active.label}»؛ این هفته ${fa(active.left)} مانده`}
              </p>
            )}
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message) => (
              <Bubble key={message.id} message={message} childName={childName}
                onRetry={message.status === 'failed' && lastQuestion && canSend
                  ? () => onAsk(lastQuestion, (message.tier || 'flash') as AiTier) : undefined} />
            ))}
            {sending && (
              <>
                <div className={styles.row} data-role="user"><div className={styles.userBubble}><p>{sending}</p></div></div>
                <Typing />
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------- کادرِ پرسش ---------- */}
      <footer className={styles.dock}>
        {strip}
        <Composer variant="hero" value={draft} onChange={onDraft} onSend={() => onAsk(draft)}
          canSend={canSend && draft.trim().length > 1 && !over} disabled={pending || guest || !thread.enabled}
          maxLength={limit} placeholder={`درباره‌ی ${childName} بپرس…`} label={`پرسش درباره‌ی ${childName}`}
          leading={(
            <button type="button" className={styles.tierButton} onClick={() => setTierSheet(true)}
              data-tone={active ? TIER_LOOK[active.key].tone : undefined}
              aria-label={`سطحِ پاسخ‌دهی: ${active?.label ?? ''}`}>
              <ActiveIcon aria-hidden />
              <span>{active?.label}</span>
              <HiOutlineChevronDown aria-hidden />
            </button>
          )} />
        {draft.length > limit * 0.8 && (
          <p className={styles.counter} data-over={over || undefined}>{fa(draft.length)} از {fa(limit)} نویسه</p>
        )}
        <p className={styles.disclaimer}>نامِ {childName} برای مدل فرستاده نمی‌شود؛ دستیار جای مشاوره‌ی متخصص را نمی‌گیرد</p>
      </footer>

      <Sheet open={tierSheet} title="سطحِ پاسخ‌دهی" onClose={() => setTierSheet(false)}>
        <div className={styles.tiers} role="radiogroup" aria-label="سطحِ پاسخ‌دهی">
          {tiers.map((item) => (
            <TierRow key={item.key} item={item} selected={item.key === active?.key}
              onSelect={() => {
                if (item.locked) onUpgrade();
                else onTier(item.key);
                setTierSheet(false);
              }} />
          ))}
        </div>
        <p className={styles.tierFoot}>سهمیه‌ها هفتگی است و هر شنبه دوباره پر می‌شود.</p>
        {!premium && (
          <button type="button" className={styles.tierUpsell} onClick={() => { setTierSheet(false); onUpgrade(); }}>
            <CrownIcon size={16} strokeWidth={2.2} aria-hidden />
            <span>
              با اشتراک هر هفته {fa(thread.quota.premiumLimits.flash)} پیام «لوکو سریع»،{' '}
              {fa(thread.quota.premiumLimits.luna)} پیام «لوکو همراه» و {fa(thread.quota.premiumLimits.pro)} پیام «لوکو بینش»
            </span>
          </button>
        )}
      </Sheet>

      <Sheet open={historySheet} title="تاریخچه‌ی گفت‌وگوها" onClose={() => setHistorySheet(false)}>
        <HistoryList thread={thread} history={history} loading={historyLoading} childName={childName}
          onPick={(id) => { setHistorySheet(false); onPickConversation(id); }}
          onDelete={onDeleteConversation} onUpgrade={() => { setHistorySheet(false); onUpgrade(); }}
          onNew={() => { setHistorySheet(false); onNewChat(); }} />
      </Sheet>
    </div>
  );
}

function HistoryList({ thread, history, loading, childName, onPick, onDelete, onUpgrade, onNew }: {
  thread: AssistantThread; history?: ConversationList; loading: boolean; childName: string;
  onPick: (id: number) => void; onDelete: (id: number) => void; onUpgrade: () => void; onNew: () => void;
}) {
  if (thread.history.locked) {
    return (
      <div className={styles.historyLocked}>
        <span aria-hidden><HiOutlineLockClosed /></span>
        <b>تاریخچه‌ی گفت‌وگوها ویژه‌ی اشتراک است</b>
        <p>
          {thread.history.count > 1
            ? `${fa(thread.history.count)} گفت‌وگو درباره‌ی ${childName} نگه داشته شده؛ با اشتراک همه را دوباره باز کنید و ادامه دهید.`
            : `با اشتراک همه‌ی گفت‌وگوهایتان درباره‌ی ${childName} نگه داشته می‌شود و هر وقت خواستید ادامه می‌دهید.`}
        </p>
        <button type="button" onClick={onUpgrade}><CrownIcon size={16} strokeWidth={2.2} aria-hidden /> دیدنِ اشتراک</button>
      </div>
    );
  }
  if (loading && !history) return <div className={styles.historyLoading} aria-hidden><i /><i /><i /></div>;
  const items = history?.items ?? [];
  return (
    <div className={styles.history}>
      <button type="button" className={styles.historyNew} onClick={onNew}>
        <HiOutlinePencilSquare aria-hidden /> گفت‌وگوی تازه
      </button>
      {items.length === 0 ? (
        <p className={styles.historyEmpty}>هنوز گفت‌وگویی نیست.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} data-active={item.id === thread.conversation?.id || undefined}>
              <button type="button" className={styles.historyItem} onClick={() => onPick(item.id)}>
                <HiOutlineChatBubbleLeftRight aria-hidden />
                <span>
                  <b>{item.title}</b>
                  <small>{item.updatedFa}، {fa(Math.ceil((item.messages ?? 0) / 2))} پرسش</small>
                </span>
              </button>
              <button type="button" className={styles.historyDelete} onClick={() => onDelete(item.id)}
                aria-label={`پاک کردنِ «${item.title}»`}>
                <HiOutlineTrash aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Strip({ icon: Icon, text, action, gold = false, danger = false }: {
  icon: Icon; text: string; action?: { label: string; onClick: () => void }; gold?: boolean; danger?: boolean;
}) {
  return (
    <div className={styles.strip} data-gold={gold || undefined} data-danger={danger || undefined} role="status">
      <Icon aria-hidden />
      <span>{text}</span>
      {action && <button type="button" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

function TierRow({ item, selected, onSelect }: { item: AssistantTier; selected: boolean; onSelect: () => void }) {
  const look = TIER_LOOK[item.key];
  const IconComp = look.icon;
  return (
    <button type="button" role="radio" aria-checked={selected} className={styles.tierRow}
      data-selected={selected || undefined} data-locked={item.locked || undefined} onClick={onSelect}>
      <span className={styles.tierIcon} data-tone={look.tone} aria-hidden>{item.locked ? <HiOutlineLockClosed /> : <IconComp />}</span>
      <span className={styles.tierText}>
        <b>{item.label}</b>
        <small>{item.note}</small>
        {item.locked ? (
          <em><CrownIcon size={12} strokeWidth={2.2} aria-hidden /> ویژه‌ی اشتراک</em>
        ) : (
          <span className={styles.tierQuota}>این هفته {fa(item.left)} از {fa(item.limit)} پیام مانده</span>
        )}
      </span>
      {selected && <span className={styles.check} aria-hidden><HiOutlineCheck /></span>}
    </button>
  );
}

function Avatar() {
  return <span className={styles.botAvatar} aria-hidden><LukoLogo height={12} /></span>;
}

function Typing() {
  return (
    <div className={styles.row} data-role="assistant">
      <div className={styles.botWrap}>
        <span className={styles.typing} aria-label="در حالِ نوشتن"><i /><i /><i /></span>
        <Avatar />
      </div>
    </div>
  );
}

function Bubble({ message, childName, onRetry }: { message: AssistantMessage; childName: string; onRetry?: () => void }) {
  if (message.role === 'user') {
    return (
      <div className={styles.row} data-role="user">
        <div className={styles.userBubble}><p>{message.content}</p></div>
      </div>
    );
  }
  if (message.status === 'pending') {
    return (
      <div className={styles.row} data-role="assistant">
        <div className={styles.botWrap}>
          <span className={styles.typing} aria-label={message.tier === 'pro'
            ? '«لوکو بینش» با دقت فکر می‌کند؛ کمی بیشتر طول می‌کشد' : `در حالِ نوشتنِ پاسخ درباره‌ی ${childName}`}>
            <i /><i /><i />
          </span>
          <Avatar />
        </div>
      </div>
    );
  }
  const failed = message.status === 'failed';
  return (
    <div className={styles.row} data-role="assistant">
      <div className={styles.botWrap}>
        <div className={styles.botBubble} data-failed={failed || undefined}>
          <RichText text={message.content} />
          {/* متنِ خطا («از سهمیه کم نشد») را خودِ سرور در پیام می‌نویسد */}
          {failed && onRetry && (
            <span className={styles.failNote}>
              <button type="button" onClick={onRetry}><HiOutlineArrowPath aria-hidden /> دوباره بپرس</button>
            </span>
          )}
        </div>
        <Avatar />
      </div>
    </div>
  );
}
