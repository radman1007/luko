import { useMemo, useState } from 'react';
import type { CSSProperties, ComponentType, SVGProps } from 'react';
import {
  HiMiniPlay,
  HiOutlineArrowLeft,
  HiOutlineBookmark,
  HiOutlineBookOpen,
  HiOutlineClock,
  HiOutlineEye,
  HiOutlineFilm,
  HiOutlineMicrophone,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { LearnKind, LearnList, LearnSummary, LearnTopic } from '../../learnApi';
import { TOPIC_CHARACTER, TOPIC_LOOK, fa } from './look';
import styles from './LearnHub.module.css';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Props {
  data: LearnList;
  childName: string;
  onOpen: (id: number) => void;
  onSave: (id: number, saved: boolean) => void;
  onUpgrade: () => void;
}

const TABS: { kind: LearnKind; label: string; icon: Icon; featured: string; latest: string; action: string;
  soon: string; locked: string }[] = [
  { kind: 'article', label: 'بلاگ', icon: HiOutlineBookOpen, featured: 'مقاله‌ی ویژه', latest: 'جدیدترین مقاله‌ها',
    action: 'مطالعه‌ی مقاله', soon: 'اولین مقاله‌ها به‌زودی منتشر می‌شوند.', locked: 'مقاله‌ی ویژه' },
  { kind: 'podcast', label: 'پادکست', icon: HiOutlineMicrophone, featured: 'پادکستِ ویژه', latest: 'جدیدترین پادکست‌ها',
    action: 'پخش', soon: 'تیمِ آموزشیِ لوکو در حالِ ضبطِ اولین پادکست‌هاست؛ تا آن موقع مقاله‌ها منتظرتان‌اند.',
    locked: 'پادکستِ ویژه' },
  { kind: 'video', label: 'ویدیو', icon: HiOutlineFilm, featured: 'ویدیوی ویژه', latest: 'جدیدترین ویدیوها',
    action: 'تماشا', soon: 'اولین ویدیوها به‌زودی منتشر می‌شوند؛ تا آن موقع مقاله‌ها منتظرتان‌اند.',
    locked: 'ویدیوی ویژه' },
];

/** «۱٫۸ هزار» */
function compact(n: number): string {
  if (n >= 1000) return `${(Math.round(n / 100) / 10).toLocaleString('fa-IR')} هزار`;
  return fa(n);
}

/** بازدید فقط وقتی معنا دارد که کم نباشد؛ وگرنه نامِ نویسنده */
const VIEWS_FROM = 100;

function minutesText(item: LearnSummary): string {
  if (!item.minutes) return '';
  return item.kind === 'article' ? `${fa(item.minutes)} دقیقه مطالعه` : `${fa(item.minutes)} دقیقه`;
}

/**
 * راهنمای والدین: سه بخشِ بلاگ، پادکست و ویدیو؛ هر بخش یک محتوای ویژه، موضوع‌ها و «جدیدترین»ها.
 * «برای فلانی» پیشنهادهای سرور از گزارشِ همان بچه است، با دلیلِ هرکدام روی کارت.
 * محتوای ویژه برای بی‌اشتراک نشانِ تاج دارد و صفحه‌ی خودش دعوت به اشتراک می‌کند.
 */
export function LearnHub({ data, onOpen, onSave, onUpgrade }: Props) {
  const [kind, setKind] = useState<LearnKind>(() => (data.counts.article ? 'article'
    : data.counts.podcast ? 'podcast' : data.counts.video ? 'video' : 'article'));
  const [topic, setTopic] = useState<LearnTopic | ''>('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [forChild, setForChild] = useState(false);
  const tab = TABS.find((t) => t.kind === kind) ?? TABS[0];

  const ofKind = useMemo(() => data.items.filter((item) => item.kind === kind), [data.items, kind]);
  const featured = data.featured?.kind === kind ? data.featured : ofKind.find((i) => i.featured) ?? ofKind[0];
  const topics = useMemo(() => {
    const seen = new Map<LearnTopic, string>();
    ofKind.forEach((item) => seen.set(item.topic, item.topicLabel));
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [ofKind]);
  const reasons = useMemo(() => new Map((data.forChild?.picks ?? []).map((p) => [p.item.id, p.reason])), [data.forChild]);
  const picksHere = ofKind.filter((item) => reasons.has(item.id));
  const filtering = Boolean(topic) || savedOnly;
  const shown = forChild ? picksHere : ofKind.filter((item) => (!topic || item.topic === topic)
    && (!savedOnly || item.saved) && (filtering || item.id !== featured?.id));
  const savedCount = data.items.filter((item) => item.saved).length;
  const lockedHere = ofKind.filter((item) => item.locked).length;

  const pick = (next: LearnKind) => {
    setKind(next);
    setTopic('');
    setSavedOnly(false);
    setForChild(false);
  };
  const filterBy = (next: { topic?: LearnTopic | ''; saved?: boolean; child?: boolean }) => {
    setTopic(next.topic ?? '');
    setSavedOnly(Boolean(next.saved));
    setForChild(Boolean(next.child));
  };

  return (
    <div className={styles.page}>
      {/* ---------- معرفی ---------- */}
      <section className={styles.hero} aria-labelledby="learn-title">
        <i className={styles.blobA} aria-hidden /><i className={styles.blobB} aria-hidden />
        <div className={styles.heroText}>
          <span className={styles.eyebrow}><HiOutlineSparkles aria-hidden /> ویژه‌ی والدینِ لوکو</span>
          <h2 id="learn-title">راهنمای <em>والدین</em></h2>
          <p>منابعِ کاربردی برای همراهیِ بهترِ فرزندتان؛ مطالب را بخوانید، گوش دهید یا تماشا کنید.</p>
        </div>
        <ul className={styles.stats} aria-label="محتوای کتابخانه">
          <li data-kind="article"><b>{fa(data.counts.article ?? 0)}</b> مقاله</li>
          <li data-kind="podcast"><b>{fa(data.counts.podcast ?? 0)}</b> پادکست</li>
          <li data-kind="video"><b>{fa(data.counts.video ?? 0)}</b> ویدیو</li>
        </ul>
        <div className={styles.heroArt} aria-hidden>
          <img src={LUKORIANS.welcome.image} alt="" loading="eager" decoding="async" />
        </div>
      </section>

      {/* ---------- سه بخش ---------- */}
      <div className={styles.tabsWrap}>
        <div className={styles.tabs} role="tablist" aria-label="نوعِ محتوا">
          {TABS.map(({ kind: k, label, icon: Icon }) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} data-on={kind === k || undefined}
              onClick={() => pick(k)}>
              <Icon aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {!featured ? (
        <div className={styles.empty}>
          <span aria-hidden><tab.icon /></span>
          <b>به‌زودی</b>
          <p>{tab.soon}</p>
          {kind !== 'article' && <button type="button" onClick={() => pick('article')}>دیدنِ مقاله‌ها</button>}
        </div>
      ) : (
        <>
          <Featured item={featured} label={tab.featured} action={tab.action} onOpen={() => onOpen(featured.id)} />

          <div className={styles.chips} aria-label="موضوع">
            <button type="button" aria-pressed={!topic && !savedOnly && !forChild}
              data-on={(!topic && !savedOnly && !forChild) || undefined} onClick={() => filterBy({})}>همه</button>
            {picksHere.length > 0 && data.forChild && (
              <button type="button" aria-pressed={forChild} data-on={forChild || undefined} data-child
                onClick={() => filterBy({ child: !forChild })}>
                <HiOutlineSparkles aria-hidden /> برای {data.forChild.childName}
              </button>
            )}
            {topics.map((t) => (
              <button key={t.key} type="button" aria-pressed={topic === t.key} data-on={topic === t.key || undefined}
                onClick={() => filterBy({ topic: topic === t.key ? '' : t.key })}>{t.label}</button>
            ))}
            {savedCount > 0 && (
              <button type="button" aria-pressed={savedOnly} data-on={savedOnly || undefined}
                onClick={() => filterBy({ saved: !savedOnly })}>
                <HiOutlineBookmark aria-hidden /> ذخیره‌شده‌ها
              </button>
            )}
          </div>

          <header className={styles.sectionHead}>
            <h3>
              <tab.icon aria-hidden />{' '}
              {forChild ? `پیشنهاد برای ${data.forChild?.childName ?? ''}` : savedOnly ? 'ذخیره‌شده‌ها' : tab.latest}
            </h3>
            <span>{fa(shown.length)} مورد</span>
          </header>

          {shown.length === 0 ? (
            <div className={styles.empty} data-small>
              <p>{savedOnly ? 'در این بخش چیزی ذخیره نکرده‌اید.' : 'همه‌ی محتوای این موضوع همان ویژه‌ی بالاست.'}</p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {shown.map((item) => (
                <li key={item.id}>
                  {kind === 'podcast' ? (
                    <PodcastCard item={item} reason={forChild ? reasons.get(item.id) : undefined}
                      onOpen={() => onOpen(item.id)} />
                  ) : kind === 'video' ? (
                    <VideoCard item={item} reason={forChild ? reasons.get(item.id) : undefined}
                      onOpen={() => onOpen(item.id)} />
                  ) : (
                    <ArticleCard item={item} reason={forChild ? reasons.get(item.id) : undefined}
                      onOpen={() => onOpen(item.id)} onSave={(saved) => onSave(item.id, saved)} />
                  )}
                </li>
              ))}
            </ul>
          )}

          {!data.premium && lockedHere > 0 && (
            <button type="button" className={styles.upsell} onClick={onUpgrade}>
              <CrownIcon size={20} strokeWidth={2} aria-hidden />
              <span>
                <b>{fa(lockedHere)} {tab.locked} با اشتراک باز می‌شود</b>
                <small>برنامه‌های چندهفته‌ای، بازی‌های خانگی و همه‌ی محتوای ویژه</small>
              </span>
              <em>دیدنِ اشتراک</em>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- تصویر
/** عکسِ شاخص، یا کاراکترِ موضوع روی رنگِ همان موضوع */
function Art({ item, big = false }: { item: LearnSummary; big?: boolean }) {
  const look = TOPIC_LOOK[item.topic] ?? TOPIC_LOOK.learning;
  if (item.cover) return <img className={styles.artImg} src={item.cover} alt="" loading="lazy" decoding="async" />;
  return (
    <span className={styles.art} data-big={big || undefined}
      style={{ '--from': look.from, '--to': look.to, '--ink': look.ink } as CSSProperties} aria-hidden>
      <i /><i />
      <img src={TOPIC_CHARACTER[item.topic] ?? TOPIC_CHARACTER.learning} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

function PremiumChip({ item }: { item: LearnSummary }) {
  if (!item.premium) return null;
  return (
    <span className={styles.premium} data-locked={item.locked || undefined}>
      <CrownIcon size={12} strokeWidth={2.2} aria-hidden /> ویژه
    </span>
  );
}

// ---------------------------------------------------------------- ویژه‌ی هر بخش
function Featured({ item, label, action, onOpen }: { item: LearnSummary; label: string; action: string;
  onOpen: () => void }) {
  if (item.kind === 'podcast') {
    return (
      <section className={styles.featPodcast} aria-label={label}>
        <div className={styles.featPodText}>
          <span className={styles.featChip}><HiOutlineMicrophone aria-hidden /> {label}</span>
          <h3>{item.title}</h3>
          <span className={styles.host}><i aria-hidden>{item.author.trim().charAt(0) || 'ل'}</i>{item.author} · {item.topicLabel}</span>
          <PremiumChip item={item} />
        </div>
        {item.minutes > 0 && <span className={styles.featTime}><HiOutlineClock aria-hidden /> {minutesText(item)}</span>}
        <button type="button" className={styles.bigPlay} onClick={onOpen} aria-label={`${action}: ${item.title}`}>
          <HiMiniPlay aria-hidden />
        </button>
        <span className={styles.eq} aria-hidden>{[40, 75, 55, 90, 60, 35, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
      </section>
    );
  }
  return (
    <section className={styles.featBanner} data-kind={item.kind} aria-label={label}>
      <Art item={item} big />
      <span className={styles.shade} aria-hidden />
      <div className={styles.featTop}>
        <span className={styles.featChip} data-light><HiOutlineSparkles aria-hidden /> {label}</span>
        <PremiumChip item={item} />
        {item.minutes > 0 && <span className={styles.featTime} data-light><HiOutlineClock aria-hidden /> {minutesText(item)}</span>}
      </div>
      {item.kind === 'video' && <span className={styles.centerPlay} aria-hidden><HiMiniPlay /></span>}
      <div className={styles.featBottom}>
        <h3>{item.title}</h3>
        {item.kind === 'video' ? (
          <span className={styles.byline}>{item.author}</span>
        ) : (
          <span className={styles.featAction} aria-hidden>{action} <HiOutlineArrowLeft /></span>
        )}
      </div>
      <button type="button" className={styles.stretch} onClick={onOpen}>
        <span className={styles.sr}>{action}: {item.title}</span>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------- کارت‌ها
/** چرا این برای همین بچه پیشنهاد شد (از گزارشِ او) — جای خلاصه می‌نشیند */
function Reason({ text }: { text: string }) {
  return <p className={styles.reason}><HiOutlineSparkles aria-hidden /> {text}</p>;
}

function ArticleCard({ item, reason, onOpen, onSave }: { item: LearnSummary; reason?: string; onOpen: () => void;
  onSave: (saved: boolean) => void }) {
  return (
    <article className={styles.card} data-done={item.done || undefined}>
      <div className={styles.thumb}>
        <Art item={item} />
        <span className={styles.topicChip}>{item.topicLabel}</span>
        <PremiumChip item={item} />
      </div>
      <div className={styles.body}>
        <h4><button type="button" className={styles.open} onClick={onOpen}>{item.title}</button></h4>
        {reason ? <Reason text={reason} /> : item.summary && <p>{item.summary}</p>}
        <footer>
          {item.minutes > 0 && <span><HiOutlineClock aria-hidden /> {minutesText(item)}</span>}
          {item.views >= VIEWS_FROM ? (
            <span><HiOutlineEye aria-hidden /> {compact(item.views)} بازدید</span>
          ) : (
            <span className={styles.by}>{item.author}</span>
          )}
          <button type="button" className={styles.save} aria-pressed={item.saved} onClick={() => onSave(!item.saved)}
            aria-label={item.saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره برای بعد'}>
            <HiOutlineBookmark aria-hidden />
          </button>
        </footer>
      </div>
    </article>
  );
}

function PodcastCard({ item, reason, onOpen }: { item: LearnSummary; reason?: string; onOpen: () => void }) {
  return (
    <article className={styles.card} data-kind="podcast" data-done={item.done || undefined}>
      <div className={styles.body}>
        <header className={styles.podHead}>
          <span className={styles.avatar} aria-hidden>{item.author.trim().charAt(0) || 'ل'}</span>
          <span><b>{item.author}</b><small>{item.kindLabel}</small></span>
          <span className={styles.topicChip} data-inline>{item.topicLabel}</span>
        </header>
        <h4><button type="button" className={styles.open} onClick={onOpen}>{item.title}</button></h4>
        {reason ? <Reason text={reason} /> : item.summary && <p>{item.summary}</p>}
        <footer>
          {item.minutes > 0 && <span><HiOutlineClock aria-hidden /> {minutesText(item)}</span>}
          <PremiumChip item={item} />
          <span className={styles.playPill} aria-hidden><HiMiniPlay /> پخش</span>
        </footer>
      </div>
    </article>
  );
}

function VideoCard({ item, reason, onOpen }: { item: LearnSummary; reason?: string; onOpen: () => void }) {
  return (
    <article className={styles.card} data-kind="video" data-done={item.done || undefined}>
      <div className={styles.thumb}>
        <Art item={item} />
        <span className={styles.topicChip}>{item.topicLabel}</span>
        <PremiumChip item={item} />
        <span className={styles.thumbPlay} aria-hidden><HiMiniPlay /></span>
        {item.minutes > 0 && <span className={styles.duration}>{fa(item.minutes)} دقیقه</span>}
      </div>
      <div className={styles.body}>
        <h4><button type="button" className={styles.open} onClick={onOpen}>{item.title}</button></h4>
        {reason ? <Reason text={reason} /> : <span className={styles.by}>{item.author}</span>}
      </div>
    </article>
  );
}
