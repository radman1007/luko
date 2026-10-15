import { useEffect, useState } from 'react';
import type { AssistantThread } from '../../assistantApi';
import { apiError } from '../../settingsApi';
import type { AiTier, ChildReport } from '../../types';
import { useAsk, useAssistant, useClearAssistant } from '../../useAssistant';
import { SubPage } from '../views/SubPage';
import { AssistantChat } from './AssistantChat';
import { AssistantHub } from './AssistantHub';
import { GUEST_THREAD } from './guestThread';
import { QUICK_ASKS } from './look';
import { MonthReport } from './MonthReport';
import styles from './AssistantPage.module.css';

export type AssistantSection = '' | 'chat' | 'month';

interface Props {
  childId?: string;
  childName: string;
  /** نامِ کوچکِ والد برای سلام */
  parentName: string;
  report?: ChildReport;
  /** حالتِ نمایشی: گفت‌وگوی نمونه، بی‌ارسال */
  guest?: boolean;
  /** `?p=assistant&s=chat|month` */
  section: string;
  onSection: (section: AssistantSection) => void;
  onGo: (page: 'details' | 'daily') => void;
  onUpgrade: () => void;
  onSupport: () => void;
  /** مهمان: رفتن به ورود */
  onLogin?: () => void;
}

/**
 * دستیارِ هوشمندِ والدین: صفحه‌ی اصلی (سلام، پرسش، رشدِ ماه و کارت‌ها)، گفت‌وگو (`s=chat`) و گزارشِ ماهانه
 * (`s=month`). گفت‌وگو و سطحِ مدل همین‌جا نگه داشته می‌شود تا پرسیدن از صفحه‌ی اصلی بی‌وقفه به گفت‌وگو برسد.
 */
export function AssistantPage({
  childId, childName, parentName, report, guest = false, section, onSection, onGo, onUpgrade, onSupport, onLogin,
}: Props) {
  const query = useAssistant(childId, !guest);
  const thread: AssistantThread | undefined = guest ? GUEST_THREAD : query.data;
  const ask = useAsk(childId ?? '');
  const clear = useClearAssistant(childId ?? '');
  const [tier, setTier] = useState<AiTier>('flash');
  const [draft, setDraft] = useState('');

  const tiers = thread?.quota.tiers ?? [];
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const premium = Boolean(report?.premium ?? thread?.quota.premium);
  const pending = Boolean(thread?.pending) || ask.isPending;

  // فرزندِ دیگر: اگر مدلِ انتخاب‌شده برای او قفل است، به «پایه» برگرد
  useEffect(() => {
    if (active?.locked) setTier('flash');
  }, [active?.locked, childId]);

  const outOfQuota = Boolean(active && !active.locked && active.left <= 0);
  const canAsk = !guest && Boolean(thread?.enabled) && !pending && !outOfQuota && Boolean(childId);
  let askNote = '';
  if (guest) askNote = 'در حالتِ نمایشی پرسیدن فعال نیست؛ نمونه‌ی گفت‌وگو را ببینید.';
  else if (thread && !thread.enabled) askNote = 'دستیار به‌زودی فعال می‌شود.';
  else if (pending) askNote = 'دستیار در حالِ پاسخ به پرسشِ قبلی است…';
  else if (outOfQuota) {
    askNote = premium ? `سهمیه‌ی امروزِ مدلِ ${active?.label} تمام شد.` : 'سهمیه‌ی امروز تمام شد؛ با اشتراک پرسش‌های بیشتری دارید.';
  }

  const send = (text: string, useTier: AiTier = tier) => {
    const clean = text.trim();
    if (guest) {
      onSection('chat');
      return;
    }
    if (!clean || !canAsk) return;
    ask.mutate({ text: clean, tier: useTier }, { onSuccess: () => setDraft('') });
    if (section !== 'chat') onSection('chat');
  };

  if (section === 'chat') {
    let body;
    if (!guest && query.isLoading) body = <div className={styles.loading} aria-hidden><i /><i /></div>;
    else if (!thread) {
      body = (
        <div className={styles.state}>
          <p>دستیار بارگذاری نشد. اتصال را بررسی کنید.</p>
          <button type="button" onClick={() => void query.refetch()}>تلاشِ دوباره</button>
        </div>
      );
    } else {
      body = (
        <AssistantChat thread={thread} childName={childName} guest={guest} tier={active?.key ?? 'flash'} onTier={setTier}
          draft={draft} onDraft={setDraft} onAsk={send}
          sending={ask.isPending && ask.variables ? ask.variables.text : null}
          error={ask.isError ? apiError(ask.error, 'پرسش فرستاده نشد؛ دوباره تلاش کنید.') : ''}
          pending={pending} onClear={() => clear.mutate()} clearing={clear.isPending}
          onUpgrade={onUpgrade} onSupport={onSupport} onLogin={onLogin} />
      );
    }
    return (
      <SubPage title="گفت‌وگو با دستیار" note={`پرسش و پاسخ درباره‌ی ${childName}، از روی گزارشِ خودش`}
        onBack={() => onSection('')} backLabel="دستیار" wide>
        {body}
      </SubPage>
    );
  }

  if (section === 'month') {
    return (
      <SubPage title={`گزارشِ ماهانه‌ی ${childName}`} note="چهار هفته‌ی اخیر، بُعد به بُعد" onBack={() => onSection('')}
        backLabel="دستیار" wide>
        <MonthReport growth={report?.growth} ai={report?.ai} childName={childName} canAsk={canAsk || guest}
          onAsk={() => send(QUICK_ASKS[3].question(childName))} onUpgrade={onUpgrade} onGoDaily={() => onGo('daily')} />
      </SubPage>
    );
  }

  return (
    <AssistantHub childName={childName} parentName={parentName} growth={report?.growth} tips={report?.tips?.items}
      ai={report?.ai} thread={thread} premium={premium} guest={guest} draft={draft} onDraft={setDraft} onAsk={send}
      canAsk={canAsk} askNote={askNote} activeTier={active} onOpenChat={() => onSection('chat')}
      onOpenMonth={() => onSection('month')} onGo={onGo} onUpgrade={onUpgrade} />
  );
}
