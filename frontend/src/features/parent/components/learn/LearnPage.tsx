import { useCallback, useState } from 'react';
import type { LearnDetail, LearnList } from '../../learnApi';
import { useLearnItem, useLearnList, useLearnProgress } from '../../useLearn';
import { SubPage } from '../views/SubPage';
import { GUEST_LEARN, guestDetail } from './guestLearn';
import { LearnHub } from './LearnHub';
import { LearnItemView } from './LearnItemView';
import styles from './LearnPage.module.css';

interface Props {
  childId?: string;
  /** فهرستِ فرزندان آمده و اولی انتخاب شده؛ وگرنه کتابخانه یک بار بی‌فرزند و بلافاصله دوباره بار می‌شود */
  ready?: boolean;
  childName: string;
  guest?: boolean;
  /** `?p=learn&s=item&id=…` */
  section: string;
  itemId: string;
  onOpen: (id: number) => void;
  onBack: () => void;
  onUpgrade: () => void;
  /** مهمان: پیام در حالتِ نمایشی */
  onNotice?: (message: string) => void;
}

/** «آموزش» پنلِ والدین: کتابخانه، یا یک محتوا اگر نشانی `s=item&id=` دارد */
export function LearnPage({ childId, ready = true, childName, guest = false, section, itemId, onOpen, onBack, onUpgrade, onNotice }: Props) {
  const id = section === 'item' ? Number(itemId) || 0 : 0;
  const list = useLearnList(childId, !guest && !id && ready);
  const item = useLearnItem(id, !guest && id > 0);
  const progress = useLearnProgress();
  // مهمان: ذخیره و «خواندم» فقط روی همین صفحه می‌ماند
  const [guestFlags, setGuestFlags] = useState<Record<number, { saved?: boolean; done?: boolean }>>({});

  const save = useCallback((target: number, body: { saved?: boolean; done?: boolean }) => {
    if (guest) {
      setGuestFlags((old) => ({ ...old, [target]: { ...old[target], ...body } }));
      if (body.saved) onNotice?.('در حالتِ نمایشی ذخیره فقط تا بستنِ صفحه می‌ماند');
      return;
    }
    progress.mutate({ id: target, ...body });
  }, [guest, onNotice, progress]);
  const markDone = useCallback((done: boolean) => save(id, { done }), [id, save]);

  if (id) {
    const detail: LearnDetail | undefined = guest
      ? (() => { const d = guestDetail(id); return d && { ...d, ...guestFlags[id] }; })()
      : item.data;
    return (
      <SubPage title="کتابخانه‌ی والدین" note={detail ? `${detail.kindLabel} · ${detail.topicLabel}` : ''} onBack={onBack}
        backLabel="آموزش" wide>
        {detail ? (
          <LearnItemView item={detail} onOpen={onOpen} onSave={(saved) => save(id, { saved })} onDone={markDone}
            onSeconds={guest ? undefined : (seconds) => progress.mutate({ id, seconds })} onUpgrade={onUpgrade} />
        ) : !guest && item.isLoading ? (
          <div className={styles.loading} aria-hidden><i /><i /></div>
        ) : (
          <div className={styles.state}>
            <p>این محتوا پیدا نشد یا دیگر منتشر نمی‌شود.</p>
            <button type="button" onClick={onBack}>بازگشت به کتابخانه</button>
          </div>
        )}
      </SubPage>
    );
  }

  const data: LearnList | undefined = guest
    ? { ...GUEST_LEARN, items: GUEST_LEARN.items.map((row) => ({ ...row, ...guestFlags[row.id] })) }
    : list.data;
  if (!data) {
    return list.isError ? (
      <div className={styles.state}>
        <p>کتابخانه بارگذاری نشد. اتصال را بررسی کنید.</p>
        <button type="button" onClick={() => void list.refetch()}>تلاشِ دوباره</button>
      </div>
    ) : (
      <div className={styles.loading} aria-hidden><i /><i /><i /></div>
    );
  }
  if (!data.items.length) {
    return <div className={styles.state}><p>کتابخانه‌ی والدین به‌زودی با اولین مقاله‌ها و ویدیوها باز می‌شود.</p></div>;
  }
  return <LearnHub data={data} childName={childName} onOpen={onOpen} onSave={(target, saved) => save(target, { saved })}
    onUpgrade={onUpgrade} />;
}
