import { useEffect, useRef } from 'react';
import {
  HiBookmark,
  HiOutlineBookmark,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineUser,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import type { LearnDetail } from '../../learnApi';
import { LearnCard } from './LearnCard';
import { LearnCover } from './LearnCover';
import { AudioPlayer, VideoPlayer } from './Players';
import { KIND_LOOK, TOPIC_LOOK, fa } from './look';
import styles from './LearnItemView.module.css';

interface Props {
  item: LearnDetail;
  onOpen: (id: number) => void;
  onSave: (saved: boolean) => void;
  onDone: (done: boolean) => void;
  onSeconds?: (seconds: number) => void;
  onUpgrade: () => void;
}

/**
 * یک مقاله، ویدیو یا پادکست. متن HTMLِ امنی است که سرور از مارک‌داونِ تیم ساخته (apps/blog/markdown).
 * محتوای قفل فقط چند بندِ اول را دارد (بقیه از سرور نمی‌آید) و بعدش دعوت به اشتراک می‌آید.
 * مقاله با رسیدن به انتهای متن «خوانده‌شده» می‌شود و ویدیو و پادکست با پایانِ پخش.
 */
export function LearnItemView({ item, onOpen, onSave, onDone, onSeconds, onUpgrade }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const kind = KIND_LOOK[item.kind];
  const topic = TOPIC_LOOK[item.topic] ?? TOPIC_LOOK.learning;
  const doneRef = useRef(item.done);
  doneRef.current = item.done;

  // مقاله: رسیدن به انتهای متن یعنی خوانده شد (یک بار، و نه برای قفل)
  useEffect(() => {
    const end = endRef.current;
    if (!end || item.kind !== 'article' || item.locked || typeof IntersectionObserver === 'undefined') return undefined;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry.isIntersecting && !doneRef.current) timer = window.setTimeout(() => onDone(true), 1500);
    });
    observer.observe(end);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [item.id, item.kind, item.locked, onDone]);

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <article className={styles.main} aria-labelledby="learn-title">
          {item.media && !item.locked ? (
            item.media.type === 'audio' ? (
              <div className={styles.podcastHead}>
                <LearnCover item={item} size="banner" />
                <AudioPlayer src={item.media.src} start={item.seconds} onProgress={onSeconds} onEnded={() => onDone(true)} />
              </div>
            ) : (
              <VideoPlayer src={item.media.src} embed={item.media.type === 'embed'} poster={item.cover} title={item.title}
                start={item.seconds} onProgress={onSeconds} onEnded={() => onDone(true)} />
            )
          ) : (
            <LearnCover item={item} size="banner" />
          )}

          <header className={styles.head}>
            <span className={styles.topic} style={{ background: topic.from, color: topic.ink }}>{item.topicLabel}</span>
            <h1 id="learn-title">{item.title}</h1>
            {item.summary && <p className={styles.lead}>{item.summary}</p>}
            <ul className={styles.meta}>
              <li><kind.icon aria-hidden />{kind.label}</li>
              {item.minutes > 0 && <li><HiOutlineClock aria-hidden />{fa(item.minutes)} {kind.unit}</li>}
              {item.author && <li><HiOutlineUser aria-hidden />{item.author}</li>}
              {item.publishedFa && <li>{item.publishedFa}</li>}
            </ul>
            <div className={styles.actions}>
              <button type="button" className={styles.action} aria-pressed={item.saved} onClick={() => onSave(!item.saved)}>
                {item.saved ? <HiBookmark aria-hidden /> : <HiOutlineBookmark aria-hidden />}
                {item.saved ? 'ذخیره شد' : 'ذخیره برای بعد'}
              </button>
              {!item.locked && (
                <button type="button" className={styles.action} data-done={item.done || undefined} aria-pressed={item.done}
                  onClick={() => onDone(!item.done)}>
                  <HiOutlineCheckCircle aria-hidden />
                  {item.done ? kind.doneAlready : kind.done}
                </button>
              )}
            </div>
          </header>

          {item.bodyHtml && (
            <div className={styles.prose} data-locked={item.locked || undefined}
              // HTML از مبدلِ امنِ سرور می‌آید (هر چیز escape می‌شود و فقط چند الگو تگ می‌شوند)
              dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
          )}
          <div ref={endRef} aria-hidden />

          {item.locked && (
            <section className={styles.locked} aria-labelledby="learn-locked">
              <span className={styles.lockIcon} aria-hidden><CrownIcon size={26} strokeWidth={2} /></span>
              <h2 id="learn-locked">
                ادامه‌ی این {kind.label} ویژه‌ی مشترکانِ لوکو است
              </h2>
              <ul>
                {['همه‌ی مقاله‌ها، ویدیوها و پادکست‌های ویژه', 'برنامه‌های گام‌به‌گام برای عادت، خواب و یادگیری',
                  'گزارشِ همه‌ی درس‌ها، حالِ روزانه و دستیارِ هوشمندِ پیشرفته'].map((text) => (
                  <li key={text}><HiOutlineCheck aria-hidden />{text}</li>
                ))}
              </ul>
              <button type="button" onClick={onUpgrade}>دیدنِ اشتراک</button>
            </section>
          )}
        </article>

        {item.related.length > 0 && (
          <aside className={styles.side} aria-labelledby="learn-related">
            <h2 id="learn-related">پیشنهادِ بعدی</h2>
            <ul>
              {item.related.map((other) => (
                <li key={other.id}><LearnCard item={other} layout="row" onOpen={() => onOpen(other.id)} /></li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
