import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineArrowLeft,
  HiOutlineArrowTrendingDown,
  HiOutlineArrowTrendingUp,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentChartBar,
  HiOutlineExclamationCircle,
  HiOutlineLightBulb,
  HiOutlineLockClosed,
  HiOutlinePresentationChartLine,
  HiOutlinePuzzlePiece,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { AssistantThread, AssistantTier } from '../../assistantApi';
import type { AiStatus, Growth, GrowthDim, GrowthLink, GrowthNote, ParentTip } from '../../types';
import { AiBadge } from '../ai/AiBadge';
import { Composer } from './Composer';
import { GrowthChart } from './GrowthChart';
import { DIM_LOOK, QUICK_ASKS, askAbout, fa } from './look';
import styles from './AssistantHub.module.css';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Props {
  childName: string;
  parentName: string;
  growth?: Growth;
  tips?: ParentTip[];
  ai?: AiStatus;
  thread?: AssistantThread;
  premium: boolean;
  guest: boolean;
  draft: string;
  onDraft: (value: string) => void;
  /** پرسیدن (و رفتن به گفت‌وگو) */
  onAsk: (text: string) => void;
  /** پرسیدن ممکن است؟ (دستیار روشن، سهمیه مانده، پاسخِ قبلی رسیده) */
  canAsk: boolean;
  /** دلیلِ بسته بودنِ پرسش، برای یک خطِ زیرِ کادر */
  askNote: string;
  activeTier?: AssistantTier;
  onOpenChat: () => void;
  onOpenMonth: () => void;
  onGo: (page: 'details' | 'daily') => void;
  onUpgrade: () => void;
}

/** پرسشِ امروز: هر روز یکی از پرسش‌هایی که سرور از گزارشِ همین بچه ساخته */
function questionOfDay(thread: AssistantThread | undefined, childName: string): string {
  const list = thread?.suggestions.length ? thread.suggestions : QUICK_ASKS.map((item) => item.question(childName));
  const day = Math.floor(Date.now() / 86_400_000);
  return list[day % list.length];
}

/**
 * صفحه‌ی اصلیِ دستیارِ هوشمند: سلام و کادرِ پرسش، پرسش‌های آماده، رشدِ چهار هفته در چهار بُعد (از داده‌ی واقعی،
 * متن با تحلیلِ هوشمند)، نقطه‌ی قوت و زمینه‌ی نیازمندِ توجه و قدمِ بعدی، پرسشِ امروز و دسترسیِ سریع.
 * بی‌اشتراک: زبان و حال در نمودار قفل‌اند، مدل‌های بهتر هم؛ دعوت به اشتراک پایینِ صفحه.
 */
export function AssistantHub(props: Props) {
  const {
    childName, parentName, growth, tips, ai, thread, premium, guest, draft, onDraft, onAsk, canAsk, askNote,
    activeTier, onOpenChat, onOpenMonth, onGo, onUpgrade,
  } = props;
  const messages = thread?.messages.length ?? 0;
  const firstTip = tips?.find((tip) => !tip.locked && tip.body);
  const next: GrowthNote | null = growth?.next
    ?? (firstTip ? { title: firstTip.title, body: firstTip.body, link: 'daily' } : null);
  const question = questionOfDay(thread, childName);

  const follow = (link: GrowthLink, title: string) => {
    if (link === 'ask') onAsk(askAbout(title));
    else onGo(link);
  };

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        {/* ---------- سلام و پرسش ---------- */}
        <section className={styles.hero} aria-labelledby="as-hello">
          <img className={styles.mascot} src={LUKORIANS.luko.image} alt="" aria-hidden loading="eager" decoding="async" />
          <div className={styles.heroText}>
            <span className={styles.eyebrow}><HiOutlineSparkles aria-hidden /> دستیارِ هوشمندِ لوکو</span>
            <h2 id="as-hello">{parentName ? `سلام، ${parentName}!` : 'سلام!'}</h2>
            <p>
              با بازی‌ها، پیشرفت در کتاب‌ها و حال‌هایی که {childName} در لوکو ثبت کرده، کمکتان می‌کنم مسیرِ رشدش را
              بهتر ببینید و قدمِ بعدی را با اطمینان بردارید.
            </p>
            <Composer variant="hero" value={draft} onChange={onDraft} onSend={() => onAsk(draft)}
              canSend={canAsk && draft.trim().length > 1} disabled={!canAsk && !guest}
              placeholder={`درباره‌ی ${childName} بپرسید…`} label={`پرسش درباره‌ی ${childName}`} />
            <div className={styles.heroFoot}>
              <span>{askNote || (activeTier
                ? `${fa(activeTier.left)} پرسش از ${fa(activeTier.limit)} پرسشِ امروز · مدلِ ${activeTier.label}`
                : '')}</span>
              {messages > 0 && (
                <button type="button" onClick={onOpenChat}>
                  <HiOutlineChatBubbleLeftRight aria-hidden /> ادامه‌ی گفت‌وگو
                </button>
              )}
            </div>
          </div>
        </section>

        <div className={styles.quick} role="group" aria-label="پرسش‌های آماده">
          {QUICK_ASKS.map(({ key, label, icon: Icon, question: build }) => (
            <button key={key} type="button" disabled={!canAsk && !guest} onClick={() => onAsk(build(childName))}>
              <span aria-hidden><Icon /></span>
              {label}
            </button>
          ))}
        </div>

        {/* ---------- رشدِ چهار هفته ---------- */}
        <GrowthCard growth={growth} ai={ai} childName={childName} onOpenMonth={onOpenMonth} onUpgrade={onUpgrade}
          onGoDaily={() => onGo('daily')} />

        {/* ---------- سه کارت ---------- */}
        <div className={styles.notes}>
          <NoteCard tone="good" icon={HiOutlineTrophy} title="نقطه‌های قابلِ توجه" note={growth?.strength ?? null}
            empty={`با چند هفته بازیِ ${childName} نقطه‌های قوتش این‌جا روشن می‌شود.`} onFollow={follow} />
          <NoteCard tone="watch" icon={HiOutlineExclamationCircle} title="زمینه‌های نیازمندِ توجه"
            note={growth?.attention ?? null} empty="فعلاً نشانه‌ای که توجهِ ویژه بخواهد دیده نشد." onFollow={follow} />
          <NoteCard tone="next" icon={HiOutlineLightBulb} title="پیشنهادِ قدمِ بعدی" note={next}
            empty={`یک بازیِ کوتاه برای امروزِ ${childName} انتخاب کنید.`} onFollow={follow}
            fallbackLink={{ label: 'انتخابِ بازیِ امروز', onClick: () => onGo('daily') }} />
        </div>

        {/* ---------- پرسشِ امروز و دسترسیِ سریع ---------- */}
        <div className={styles.bottom}>
          <section className={styles.today} aria-labelledby="as-today">
            <img src={LUKORIANS.navigator.image} alt="" aria-hidden loading="lazy" decoding="async" />
            <div>
              <h3 id="as-today"><HiOutlineSparkles aria-hidden /> پرسشِ امروزِ شما</h3>
              <p>«{question}»</p>
              <button type="button" className={styles.todayBtn} disabled={!canAsk && !guest} onClick={() => onAsk(question)}>
                <HiOutlineSparkles aria-hidden /> دریافتِ پاسخِ هوشمند
              </button>
            </div>
          </section>

          <section className={styles.access} aria-labelledby="as-access">
            <h3 id="as-access">دسترسیِ سریع</h3>
            <div>
              <Tile icon={HiOutlinePuzzlePiece} label="فعالیت‌ها" note="بازی‌ها و جلسه‌ها" onClick={() => onGo('details')} />
              <Tile icon={HiOutlineStar} label="فعالیت‌های پیشنهادی" note="بازیِ روز" onClick={() => onGo('daily')} />
              <Tile icon={HiOutlineDocumentChartBar} label="گزارشِ ماهانه" note="چهار هفته، بُعد به بُعد"
                onClick={onOpenMonth} />
            </div>
          </section>
        </div>

        {!premium && (
          <button type="button" className={styles.upsell} onClick={onUpgrade}>
            <span className={styles.upsellIcon} aria-hidden><HiOutlineLockClosed /></span>
            <span className={styles.upsellText}>
              <b>نسخه‌ی پیشرفته‌ی دستیارِ هوشمند</b>
              <small>
                مدل‌های حرفه‌ای و پیشرفته، مهارت‌های زبانی و حالِ خوب در نمودارِ رشد، و تا{' '}
                {fa(thread?.quota.premiumLimits.flash ?? 40)} پرسش در روز با اشتراکِ {childName}
              </small>
            </span>
            <span className={styles.upsellCta}>دیدنِ پلن‌ها <HiOutlineArrowLeft aria-hidden /></span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- کارت‌ها
function GrowthCard({ growth, ai, childName, onOpenMonth, onUpgrade, onGoDaily }: {
  growth?: Growth; ai?: AiStatus; childName: string; onOpenMonth: () => void; onUpgrade: () => void;
  onGoDaily: () => void;
}) {
  const dims = (growth?.dims ?? []).filter((dim) => dim.status !== 'none');
  const drawn = dims.filter((dim) => !dim.locked && dim.points.some((point) => point !== null));
  return (
    <section className={styles.growth} aria-labelledby="as-growth">
      <header className={styles.cardHead}>
        <span className={styles.badge} data-tone="growth" aria-hidden><HiOutlinePresentationChartLine /></span>
        <div>
          <h3 id="as-growth">گزارشِ کلیِ رشد در یک ماهِ گذشته</h3>
          <p>از بازی‌ها، پیشرفت در کتاب‌ها و حال‌هایی که {childName} در لوکو ثبت کرده</p>
        </div>
        <AiBadge ai={ai} written={growth?.source === 'ai'} />
      </header>

      {!growth ? (
        <p className={styles.waiting}>گزارشِ این ماه در حالِ آماده شدن است؛ چند لحظه‌ی دیگر دوباره سر بزنید.</p>
      ) : !growth.active ? (
        <div className={styles.waiting}>
          <p>{growth.summary}</p>
          <button type="button" onClick={onGoDaily}>انتخابِ بازیِ امروز</button>
        </div>
      ) : (
        <div className={styles.growthBody}>
          <ul className={styles.legend} aria-label="بُعدهای رشد">
            {dims.map((dim) => <LegendItem key={dim.key} dim={dim} onUpgrade={onUpgrade} />)}
          </ul>
          <div className={styles.chart}>
            {drawn.length ? <GrowthChart weeks={growth.weeks} dims={drawn} /> : (
              <p className={styles.waiting}>هنوز برای کشیدنِ نمودار داده‌ی کافی نیست.</p>
            )}
          </div>
          <div className={styles.summary}>
            <span aria-hidden><HiOutlineSparkles /></span>
            <p>{growth.summary}</p>
            <button type="button" onClick={onOpenMonth}>مشاهده‌ی جزئیاتِ بیشتر <HiOutlineArrowLeft aria-hidden /></button>
          </div>
        </div>
      )}
    </section>
  );
}

function LegendItem({ dim, onUpgrade }: { dim: GrowthDim; onUpgrade: () => void }) {
  const look = DIM_LOOK[dim.key];
  const Icon = look.icon;
  const head = (
    <>
      <span className={styles.dimIcon} style={{ background: look.soft, color: look.color }} aria-hidden><Icon /></span>
      <span className={styles.dimName}>
        <i style={{ background: look.color }} aria-hidden />
        {dim.label}
      </span>
    </>
  );
  if (dim.locked) {
    return (
      <li>
        <button type="button" className={styles.dim} data-locked onClick={onUpgrade}
          aria-label={`${dim.label}: با اشتراک باز می‌شود`}>
          {head}
          <em className={styles.lockChip}><CrownIcon size={12} strokeWidth={2.2} aria-hidden /> با اشتراک</em>
        </button>
      </li>
    );
  }
  const change = dim.change;
  return (
    <li className={styles.dim}>
      {head}
      {dim.now === null ? (
        <em className={styles.dimMuted}>{dim.status === 'empty' && dim.kind === 'progress' ? 'هنوز شروع نشده' : 'داده‌ی کافی نیست'}</em>
      ) : (
        <span className={styles.dimValue}>
          <b>{fa(dim.now)}٪</b>
          {change !== null && change !== 0 && (
            <em data-dir={change > 0 ? 'up' : 'down'}>
              {change > 0 ? <HiOutlineArrowTrendingUp aria-hidden /> : <HiOutlineArrowTrendingDown aria-hidden />}
              {fa(Math.abs(change))}
              <span className={styles.sr}>{change > 0 ? ' بیشتر از هفته‌ی اول' : ' کمتر از هفته‌ی اول'}</span>
            </em>
          )}
        </span>
      )}
    </li>
  );
}

const FOLLOW_LABEL: Record<GrowthLink, string> = {
  details: 'مشاهده‌ی گزارشِ کامل',
  daily: 'مشاهده‌ی فعالیتِ پیشنهادی',
  ask: 'پرسیدن از دستیار',
};

function NoteCard({ tone, icon: Icon, title, note, empty, onFollow, fallbackLink }: {
  tone: 'good' | 'watch' | 'next'; icon: Icon; title: string; note: GrowthNote | null; empty: string;
  onFollow: (link: GrowthLink, title: string) => void; fallbackLink?: { label: string; onClick: () => void };
}) {
  return (
    <section className={styles.note} data-tone={tone}>
      <header>
        <span className={styles.badge} data-tone={tone} aria-hidden><Icon /></span>
        <h3>{title}</h3>
      </header>
      {note ? (
        <>
          <b>{note.title}</b>
          <p>{note.body}</p>
          <button type="button" onClick={() => onFollow(note.link, note.title)}>
            {FOLLOW_LABEL[note.link]} <HiOutlineArrowLeft aria-hidden />
          </button>
        </>
      ) : (
        <>
          <p className={styles.noteEmpty}>{empty}</p>
          {fallbackLink && (
            <button type="button" onClick={fallbackLink.onClick}>{fallbackLink.label} <HiOutlineArrowLeft aria-hidden /></button>
          )}
        </>
      )}
    </section>
  );
}

function Tile({ icon: Icon, label, note, onClick }: { icon: Icon; label: string; note: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.tile} onClick={onClick}>
      <span aria-hidden><Icon /></span>
      <b>{label}</b>
      <small>{note}</small>
    </button>
  );
}
