import { useMemo, useState } from 'react';
import { HiOutlineArrowLeft, HiOutlineBookmark, HiOutlineSparkles } from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { LearnKind, LearnList, LearnTopic } from '../../learnApi';
import { LearnCard } from './LearnCard';
import { LearnCover } from './LearnCover';
import { KIND_LOOK, TOPIC_LOOK, fa } from './look';
import styles from './LearnHub.module.css';

interface Props {
  data: LearnList;
  childName: string;
  onOpen: (id: number) => void;
  onSave: (id: number, saved: boolean) => void;
  onUpgrade: () => void;
}

const KINDS: LearnKind[] = ['article', 'video', 'podcast'];

/**
 * کتابخانه‌ی والدین: برگزیده، پیشنهاد از روی گزارشِ همین بچه، و همه‌ی مقاله‌ها، ویدیوها و پادکست‌ها با
 * فیلترِ نوع، موضوع و ذخیره‌شده‌ها. محتوای ویژه برای بی‌اشتراک با نشانِ قفل و دعوت به اشتراک می‌آید.
 */
export function LearnHub({ data, childName, onOpen, onSave, onUpgrade }: Props) {
  const [kind, setKind] = useState<LearnKind | 'all'>('all');
  const [topic, setTopic] = useState<LearnTopic | ''>('');
  const [savedOnly, setSavedOnly] = useState(false);

  const savedCount = data.items.filter((item) => item.saved).length;
  const shown = useMemo(() => data.items.filter((item) =>
    (kind === 'all' || item.kind === kind) && (!topic || item.topic === topic) && (!savedOnly || item.saved)),
  [data.items, kind, topic, savedOnly]);

  const featured = data.featured;
  const picks = data.forChild?.picks ?? [];
  const missing = KINDS.filter((k) => !data.counts[k]);

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        {featured && (
          <div className={styles.featCell}>
            <section className={styles.featured} aria-labelledby="learn-featured">
              <img className={styles.mascot} src={LUKORIANS.welcome.image} alt="" aria-hidden loading="eager" decoding="async" />
              <div className={styles.featText}>
                <span className={styles.eyebrow}>کتابخانه‌ی والدینِ لوکو · برگزیده</span>
                <h2 id="learn-featured">{featured.title}</h2>
                <p>{featured.summary}</p>
                <ul className={styles.stats} aria-label="محتوای کتابخانه">
                  {KINDS.filter((k) => data.counts[k]).map((k) => {
                    const Icon = KIND_LOOK[k].icon;
                    return <li key={k}><Icon aria-hidden />{fa(data.counts[k])} {KIND_LOOK[k].label}</li>;
                  })}
                  {missing.length > 0 && missing.length < 3 && (
                    <li data-soon>{missing.map((k) => KIND_LOOK[k].label).join(' و ')} به‌زودی</li>
                  )}
                </ul>
                <button type="button" className={styles.cta} onClick={() => onOpen(featured.id)}>
                  {featured.locked ? 'نگاهی بیندازید' : KIND_LOOK[featured.kind].verb}
                  {featured.minutes > 0 && <small className={styles.ctaTime}>{fa(featured.minutes)} دقیقه</small>}
                  <HiOutlineArrowLeft aria-hidden />
                </button>
              </div>
              <button type="button" className={styles.featCover} onClick={() => onOpen(featured.id)} tabIndex={-1} aria-hidden>
                <LearnCover item={featured} size="hero" />
              </button>
            </section>
          </div>
        )}

        <aside className={styles.side} aria-labelledby="learn-side">
          {picks.length > 0 ? (
            <>
              <header className={styles.sideHead}>
                <span className={styles.sideIcon} aria-hidden><HiOutlineSparkles /></span>
                <div>
                  <h3 id="learn-side">پیشنهاد برای {data.forChild?.childName ?? childName}</h3>
                  <p>از روی گزارشِ همین هفته‌ی {data.forChild?.childName ?? childName}</p>
                </div>
              </header>
              <ul className={styles.picks}>
                {picks.map(({ item, reason }) => (
                  <li key={item.id}><LearnCard item={item} reason={reason} layout="row" onOpen={() => onOpen(item.id)} /></li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <header className={styles.sideHead}>
                <span className={styles.sideIcon} aria-hidden><HiOutlineSparkles /></span>
                <div>
                  <h3 id="learn-side">موضوع‌ها</h3>
                  <p>هر موضوع چند خواندنیِ کوتاه و کاربردی</p>
                </div>
              </header>
              <ul className={styles.topicGrid}>
                {data.topics.map((t) => {
                  const look = TOPIC_LOOK[t.key];
                  const Icon = look.icon;
                  return (
                    <li key={t.key}>
                      <button type="button" style={{ background: look.from, color: look.ink }}
                        onClick={() => { setTopic(t.key); setKind('all'); setSavedOnly(false); }}>
                        <Icon aria-hidden /><b>{t.label}</b><small>{fa(t.count)} محتوا</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <section className={styles.library} aria-labelledby="learn-all">
          <header className={styles.libHead}>
            <h3 id="learn-all">همه‌ی محتواها</h3>
            <div className={styles.kinds} role="tablist" aria-label="نوعِ محتوا">
              <button type="button" role="tab" aria-selected={kind === 'all'} data-on={kind === 'all' || undefined}
                onClick={() => setKind('all')}>همه <em>{fa(data.items.length)}</em></button>
              {KINDS.map((k) => {
                const Icon = KIND_LOOK[k].icon;
                return (
                  <button key={k} type="button" role="tab" aria-selected={kind === k} data-on={kind === k || undefined}
                    onClick={() => setKind(k)}>
                    <Icon aria-hidden />{KIND_LOOK[k].plural} <em>{fa(data.counts[k] ?? 0)}</em>
                  </button>
                );
              })}
            </div>
          </header>

          <div className={styles.chips} aria-label="موضوع">
            <button type="button" aria-pressed={!topic && !savedOnly} data-on={(!topic && !savedOnly) || undefined}
              onClick={() => { setTopic(''); setSavedOnly(false); }}>همه‌ی موضوع‌ها</button>
            {data.topics.map((t) => (
              <button key={t.key} type="button" aria-pressed={topic === t.key} data-on={topic === t.key || undefined}
                onClick={() => setTopic(topic === t.key ? '' : t.key)}>{t.label}</button>
            ))}
            <button type="button" className={styles.savedChip} aria-pressed={savedOnly} data-on={savedOnly || undefined}
              onClick={() => setSavedOnly(!savedOnly)}>
              <HiOutlineBookmark aria-hidden /> ذخیره‌شده‌ها <em>{fa(savedCount)}</em>
            </button>
          </div>

          {!data.premium && data.locked > 0 && (
            <button type="button" className={styles.upsell} onClick={onUpgrade}>
              <span className={styles.upsellIcon} aria-hidden><CrownIcon size={22} strokeWidth={2} /></span>
              <span className={styles.upsellText}>
                <b>{fa(data.locked)} محتوای ویژه با اشتراک باز می‌شود</b>
                <small>برنامه‌های چندهفته‌ای، بازی‌های خانگیِ ریاضی، خواب و یادگیری و همه‌ی ویدیوها و پادکست‌های ویژه</small>
              </span>
              <span className={styles.upsellCta}>دیدنِ اشتراک</span>
            </button>
          )}

          {shown.length === 0 ? (
            <div className={styles.empty}>
              {(() => {
                const Icon = kind === 'all' ? HiOutlineBookmark : KIND_LOOK[kind].icon;
                return <span aria-hidden><Icon /></span>;
              })()}
              <b>
                {savedOnly ? 'هنوز چیزی ذخیره نکرده‌اید'
                  : kind !== 'all' && !data.counts[kind] ? `اولین ${KIND_LOOK[kind].plural} به‌زودی منتشر می‌شوند`
                    : 'محتوایی با این فیلتر نیست'}
              </b>
              <p>
                {savedOnly ? 'با نشانکِ روی هر کارت، خواندنی‌ها را برای بعد نگه دارید.'
                  : kind !== 'all' && !data.counts[kind] ? 'تیمِ آموزشیِ لوکو در حالِ آماده‌کردنشان است؛ تا آن موقع مقاله‌ها منتظرتان‌اند.'
                    : 'فیلترِ دیگری انتخاب کنید.'}
              </p>
              {(kind !== 'all' || topic || savedOnly) && (
                <button type="button" onClick={() => { setKind('all'); setTopic(''); setSavedOnly(false); }}>دیدنِ همه</button>
              )}
            </div>
          ) : (
            <ul className={styles.grid}>
              {shown.map((item) => (
                <li key={item.id}>
                  <LearnCard item={item} onOpen={() => onOpen(item.id)} onSave={(saved) => onSave(item.id, saved)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
