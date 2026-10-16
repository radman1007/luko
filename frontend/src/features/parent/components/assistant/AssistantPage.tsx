import { useEffect, useState } from 'react';
import type { AssistantThread } from '../../assistantApi';
import { apiError } from '../../settingsApi';
import type { AiTier, Child } from '../../types';
import { useAsk, useAssistant, useClearAssistant } from '../../useAssistant';
import { AssistantChat } from './AssistantChat';
import { GUEST_THREAD } from './guestThread';
import styles from './AssistantPage.module.css';

interface Props {
  childId?: string;
  childName: string;
  /** فرزندها برای انتخاب از نوارِ بالای گفت‌وگو */
  childList: Child[];
  onChildChange: (id: string) => void;
  /** حالتِ نمایشی: گفت‌وگوی نمونه، بی‌ارسال */
  guest?: boolean;
  onUpgrade: () => void;
  onSupport: () => void;
  /** مهمان: رفتن به ورود */
  onLogin?: () => void;
}

/**
 * دستیارِ هوشمندِ والدین: یک گفت‌وگوی تمام‌صفحه درباره‌ی فرزندِ انتخاب‌شده. گفت‌وگو و سطحِ پاسخ‌دهی همین‌جا
 * نگه داشته می‌شود؛ پیش‌نویس با عوضِ فرزند پاک نمی‌شود.
 */
export function AssistantPage({
  childId, childName, childList, onChildChange, guest = false, onUpgrade, onSupport, onLogin,
}: Props) {
  const query = useAssistant(childId, !guest);
  const thread: AssistantThread | undefined = guest ? GUEST_THREAD : query.data;
  const ask = useAsk(childId ?? '');
  const clear = useClearAssistant(childId ?? '');
  const [tier, setTier] = useState<AiTier>('flash');
  const [draft, setDraft] = useState('');

  const tiers = thread?.quota.tiers ?? [];
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const pending = Boolean(thread?.pending) || ask.isPending;

  // فرزندِ دیگر: اگر سطحِ انتخاب‌شده برای او قفل است، به «پایه» برگرد
  useEffect(() => {
    if (active?.locked) setTier('flash');
  }, [active?.locked, childId]);

  const outOfQuota = Boolean(active && !active.locked && active.left <= 0);
  const canAsk = !guest && Boolean(thread?.enabled) && !pending && !outOfQuota && Boolean(childId);

  const send = (text: string, useTier: AiTier = active?.key ?? tier) => {
    const clean = text.trim();
    if (guest) {
      onLogin?.();
      return;
    }
    if (!clean || !canAsk) return;
    ask.mutate({ text: clean, tier: useTier }, { onSuccess: () => setDraft('') });
  };

  if (!guest && query.isLoading) return <div className={styles.loading} aria-hidden><i /><i /></div>;
  if (!thread) {
    return (
      <div className={styles.state}>
        <p>دستیار بارگذاری نشد. اتصال را بررسی کنید.</p>
        <button type="button" onClick={() => void query.refetch()}>تلاشِ دوباره</button>
      </div>
    );
  }
  return (
    <AssistantChat thread={thread} childName={childName} childList={childList} activeChildId={childId}
      onChildChange={onChildChange} guest={guest} tier={active?.key ?? 'flash'} onTier={setTier}
      draft={draft} onDraft={setDraft} onAsk={send}
      sending={ask.isPending && ask.variables ? ask.variables.text : null}
      error={ask.isError ? apiError(ask.error, 'پرسش فرستاده نشد؛ دوباره تلاش کنید.') : ''}
      pending={pending} onClear={() => clear.mutate()} clearing={clear.isPending}
      onUpgrade={onUpgrade} onSupport={onSupport} onLogin={onLogin} />
  );
}
