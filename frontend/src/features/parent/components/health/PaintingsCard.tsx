import { useState } from 'react';
import {
  HiOutlineArrowPath, HiOutlineLockClosed, HiOutlinePaintBrush, HiOutlineSparkles,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { apiError } from '../../settingsApi';
import type { ChildPainting } from '../../paintingsApi';
import { useAnalyzePainting, usePainting, usePaintings } from '../../usePaintings';
import { RichText } from '../ai/RichText';
import { Sheet } from '../shell/Sheet';
import { CardHead } from './CardHead';
import card from './card.module.css';
import styles from './PaintingsCard.module.css';

interface Props {
  childId?: string;
  childName: string;
  /** حالتِ نمایشی: API ندارد */
  guest?: boolean;
  onUpgrade: () => void;
}

const SHOWN = 8;

/**
 * نقاشی‌هایی که بچه در لوکو کشیده و «نگهش‌دار» زده (apps.health.Painting). والد هر نقاشی را باز می‌کند و جدا
 * می‌تواند برداشتِ دستیار را بخواهد (با اشتراکِ همین فرزند؛ Luna تصویر را می‌بیند).
 */
export function PaintingsCard({ childId, childName, guest = false, onUpgrade }: Props) {
  const gallery = usePaintings(guest ? undefined : childId);
  const [openId, setOpenId] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const items = gallery.data?.items ?? [];
  const shown = all ? items : items.slice(0, SHOWN);

  let body;
  if (guest) {
    body = <p className={card.empty}>نقاشی‌هایی که {childName} در لوکو بکشد و نگه دارد این‌جا می‌آید؛ هر کدام را می‌توانید باز کنید و تحلیلش را بخواهید.</p>;
  } else if (gallery.isLoading) {
    body = <div className={styles.skeleton} aria-hidden><i /><i /><i /><i /></div>;
  } else if (gallery.isError) {
    body = (
      <p className={card.empty}>
        نقاشی‌ها بارگذاری نشد. <button type="button" className={styles.inline} onClick={() => void gallery.refetch()}>دوباره</button>
      </p>
    );
  } else if (!items.length) {
    body = <p className={card.empty}>{childName} هنوز نقاشی‌ای نگه نداشته؛ نقاشی‌هایی که در «بومِ نقاشی» بکشد و «نگهش‌دار» بزند این‌جا می‌آید.</p>;
  } else {
    body = (
      <>
        <ul className={styles.grid}>
          {shown.map((item) => (
            <li key={item.id}>
              <Thumb item={item} onOpen={() => setOpenId(item.id)} />
            </li>
          ))}
        </ul>
        {items.length > SHOWN && (
          <button type="button" className={styles.more} onClick={() => setAll(!all)}>
            {all ? 'نمایشِ کمتر' : `همه‌ی ${items.length.toLocaleString('fa-IR')} نقاشی`}
          </button>
        )}
      </>
    );
  }

  return (
    <section className={card.card} aria-labelledby="paintings-title">
      <CardHead id="paintings-title" icon={HiOutlinePaintBrush} tone="rose" title={`نقاشی‌های ${childName}`}
        note="هر نقاشی را باز کنید و برداشتِ دستیارِ لوکو را از آن بخواهید" />
      {body}
      {childId && !guest && (
        <PaintingSheet childId={childId} id={openId} childName={childName} onClose={() => setOpenId(null)}
          onUpgrade={() => { setOpenId(null); onUpgrade(); }} />
      )}
    </section>
  );
}

function Thumb({ item, onOpen }: { item: ChildPainting; onOpen: () => void }) {
  const status = item.analysis?.status;
  return (
    <button type="button" className={styles.thumb} onClick={onOpen}
      aria-label={`نقاشیِ ${item.title || item.when}${status === 'done' ? '، تحلیل‌شده' : ''}`}>
      <span className={styles.frame}>
        {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" decoding="async" /> : <HiOutlinePaintBrush aria-hidden />}
        {status === 'done' && <span className={styles.analyzed} aria-hidden><HiOutlineSparkles /></span>}
      </span>
      <span className={styles.caption}>
        <b>{item.title || 'بی‌نام'}</b>
        <small>{item.when}</small>
      </span>
    </button>
  );
}

function PaintingSheet({ childId, id, childName, onClose, onUpgrade }: {
  childId: string; id: number | null; childName: string; onClose: () => void; onUpgrade: () => void;
}) {
  const detail = usePainting(childId, id);
  const analyze = useAnalyzePainting(childId);
  const data = detail.data && detail.data.id === id ? detail.data : undefined;
  const analysis = data?.analysis;

  let analysisBox;
  if (!data) {
    analysisBox = null;
  } else if (!data.enabled) {
    analysisBox = <p className={styles.note}>تحلیلِ نقاشی به‌زودی فعال می‌شود.</p>;
  } else if (!data.premium && analysis?.status !== 'done') {
    analysisBox = (
      <div className={styles.locked}>
        <HiOutlineLockClosed aria-hidden />
        <span>تحلیلِ نقاشی با اشتراکِ {childName} باز می‌شود.</span>
        <button type="button" onClick={onUpgrade}><CrownIcon size={15} strokeWidth={2.2} aria-hidden /> اشتراک</button>
      </div>
    );
  } else if (analysis?.status === 'pending' || analyze.isPending) {
    analysisBox = (
      <div className={styles.pending} role="status">
        <span className={styles.dots} aria-hidden><i /><i /><i /></span>
        دستیار در حالِ دیدنِ نقاشی است…
      </div>
    );
  } else if (analysis?.status === 'done') {
    analysisBox = (
      <div className={styles.reading}>
        <span className={styles.readingHead}><HiOutlineSparkles aria-hidden /> برداشتِ دستیارِ لوکو</span>
        <div className={styles.readingText}><RichText text={analysis.content ?? ''} /></div>
        <small>این یک برداشتِ کلی است، نه تشخیص؛ بهترین راه، شنیدنِ داستانِ نقاشی از زبانِ خودِ {childName} است.</small>
      </div>
    );
  } else {
    const failed = analysis?.status === 'failed';
    analysisBox = (
      <div className={styles.ask}>
        {failed && <p className={styles.error} role="alert">{analysis?.content || 'تحلیل آماده نشد.'}</p>}
        {analyze.isError && <p className={styles.error} role="alert">{apiError(analyze.error, 'درخواست فرستاده نشد؛ دوباره تلاش کنید.')}</p>}
        <button type="button" className={styles.primary} onClick={() => id !== null && analyze.mutate(id)}>
          {failed ? <HiOutlineArrowPath aria-hidden /> : <HiOutlineSparkles aria-hidden />}
          {failed ? 'دوباره تحلیل کن' : 'تحلیلِ این نقاشی'}
        </button>
        <small>دستیار نقاشی، رنگ‌ها و حالی را که {childName} آن روز گفته می‌بیند و چند پیشنهادِ ساده می‌دهد.</small>
      </div>
    );
  }

  return (
    <Sheet open={id !== null} title={data?.title || 'نقاشی'} onClose={onClose}>
      {!data ? (
        detail.isError
          ? <p className={styles.note}>نقاشی باز نشد؛ اتصال را بررسی کنید.</p>
          : <div className={styles.loadingImage} aria-hidden />
      ) : (
        <div className={styles.sheet}>
          <div className={styles.full}><img src={data.image || data.thumbnail} alt={`نقاشیِ ${childName}`} /></div>
          <div className={styles.meta}>
            <span>{data.when}</span>
            {data.moodLabel && <span>حالش آن روز: <b>{data.moodLabel}</b></span>}
          </div>
          {data.colors.length > 0 && (
            <ul className={styles.swatches} aria-label="رنگ‌های به‌کاررفته">
              {data.colors.slice(0, 6).map((c) => (
                <li key={c.color}><i style={{ background: c.color }} aria-hidden />{c.label || 'رنگ'}</li>
              ))}
            </ul>
          )}
          {analysisBox}
        </div>
      )}
    </Sheet>
  );
}
