import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBolt,
  HiOutlineCheck,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineExclamationCircle,
  HiOutlineLockClosed,
  HiOutlineSparkles,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { AssistantMessage, AssistantThread, AssistantTier } from '../../assistantApi';
import type { AiTier, Child } from '../../types';
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
  onUpgrade: () => void;
  onSupport: () => void;
  onLogin?: () => void;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

const TIER_LOOK: Record<AiTier, { icon: Icon; note: string }> = {
  flash: { icon: HiOutlineBolt, note: 'سریع و همه‌کاره' },
  pro: { icon: HiOutlineSparkles, note: 'تحلیلِ عمیق‌تر' },
  luna: { icon: CrownIcon as Icon, note: 'بهترین کیفیت' },
};

/**
 * دستیارِ هوشمندِ والدین: گفت‌وگو درباره‌ی یک فرزند، با پاسخی که از بازی‌ها و حال‌های خودِ او ساخته می‌شود.
 * سه سطح: «پایه» برای همه، «حرفه‌ای» و «پیشرفته» با اشتراکِ همین فرزند؛ هرکدام سهمیه‌ی روزانه دارد.
 * پاسخ در صفِ سرور ساخته می‌شود و صفحه تا رسیدنش گفت‌وگو را دوباره می‌خواند.
 */
export function AssistantChat(props: Props) {
  const {
    thread, childName, childList, activeChildId, onChildChange, guest, tier, onTier, draft, onDraft, onAsk, sending,
    error, pending, onClear, clearing, onUpgrade, onSupport, onLogin,
  } = props;
  const [tierSheet, setTierSheet] = useState(false);
  const [childMenu, setChildMenu] = useState(false);
  const scrolled = useRef(false);
  const tiers = thread.quota.tiers;
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const premium = thread.quota.premium;
  const messages = thread.messages;
  const empty = messages.length === 0 && !sending;

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
        text={premium ? `سهمیه‌ی امروزِ سطحِ ${active?.label} تمام شد؛ سطحِ دیگری را انتخاب کنید.` : 'سهمیه‌ی رایگانِ امروز تمام شد'}
        action={premium ? undefined : { label: 'اشتراک', onClick: onUpgrade }} gold />
    );
  } else if (error) {
    strip = <Strip icon={HiOutlineExclamationCircle} text={error} danger />;
  }

  return (
    <div className={styles.page}>
      {/* ---------- نوارِ بالا ---------- */}
      <header className={styles.bar}>
        <span className={styles.brandAvatar} aria-hidden><img src={LUKORIANS.luko.image} alt="" /></span>
        <b className={styles.brand}>دستیار لوکو</b>
        <div className={styles.barEnd}>
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
          <button type="button" className={styles.crown} onClick={onUpgrade}
            aria-label={premium ? 'اشتراکِ فعال' : 'دیدنِ اشتراک'}>
            <CrownIcon size={18} strokeWidth={2} aria-hidden />
            {!premium && <i aria-hidden />}
          </button>
        </div>
      </header>

      {/* ---------- گفت‌وگو ---------- */}
      <div className={styles.thread} aria-live="polite">
        {empty ? (
          <div className={styles.empty}>
            <span className={styles.mascot} aria-hidden><img src={LUKORIANS.luko.image} alt="" /></span>
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
                  ? `امروز ${fa(active.left)} پرسش در سطحِ ${active.label} داری`
                  : `روزی ${fa(thread.quota.freeLimit)} پرسشِ رایگان داری · امروز ${fa(active.left)} مانده`}
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
          canSend={canSend && draft.trim().length > 1} disabled={pending || guest || !thread.enabled}
          placeholder={`درباره‌ی ${childName} بپرس…`} label={`پرسش درباره‌ی ${childName}`}
          leading={(
            <button type="button" className={styles.tierButton} onClick={() => setTierSheet(true)}
              aria-label={`سطحِ پاسخ‌دهی: ${active?.label ?? ''}`}>
              <ActiveIcon aria-hidden />
              <span>{active?.label}</span>
              <HiOutlineChevronDown aria-hidden />
            </button>
          )} />
        <p className={styles.disclaimer}>نامِ {childName} برای مدل فرستاده نمی‌شود · دستیار جای مشاوره‌ی متخصص را نمی‌گیرد</p>
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
        {!premium && (
          <button type="button" className={styles.tierUpsell} onClick={() => { setTierSheet(false); onUpgrade(); }}>
            <CrownIcon size={16} strokeWidth={2.2} aria-hidden />
            با اشتراک هر روز تا {fa(thread.quota.premiumLimits.flash)} پرسش و سطح‌های حرفه‌ای و پیشرفته
          </button>
        )}
      </Sheet>
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
      <span className={styles.tierIcon} aria-hidden>{item.locked ? <HiOutlineLockClosed /> : <IconComp />}</span>
      <span className={styles.tierText}>
        <b>{item.label} <small>· <bdi dir="ltr">{item.name}</bdi></small></b>
        {item.locked ? (
          <em><CrownIcon size={12} strokeWidth={2.2} aria-hidden /> ویژه‌ی اشتراک</em>
        ) : (
          <small>{look.note} · امروز {fa(item.left)} از {fa(item.limit)}</small>
        )}
      </span>
      {selected && <span className={styles.check} aria-hidden><HiOutlineCheck /></span>}
    </button>
  );
}

/** «**پررنگ**» و فهرستِ «• » در پاسخِ دستیار — بی‌HTML، فقط متن */
function RichText({ text }: { text: string }) {
  const bold = (line: string) => line.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const list = line.startsWith('• ');
    const last = blocks[blocks.length - 1];
    const value = list ? line.slice(2) : line;
    if (last && last.list && list) last.lines.push(value);
    else blocks.push({ list, lines: [value] });
  }
  return (
    <>
      {blocks.map((block, index) => (block.list ? (
        <ul key={index}>{block.lines.map((line, i) => <li key={i}>{bold(line)}</li>)}</ul>
      ) : (
        block.lines.map((line, i) => <p key={`${index}-${i}`}>{bold(line)}</p>)
      )))}
    </>
  );
}

function Avatar() {
  return <span className={styles.botAvatar} aria-hidden><img src={LUKORIANS.luko.image} alt="" /></span>;
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
            ? 'سطحِ حرفه‌ای با دقت فکر می‌کند؛ کمی بیشتر طول می‌کشد' : `در حالِ نوشتنِ پاسخ درباره‌ی ${childName}`}>
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
