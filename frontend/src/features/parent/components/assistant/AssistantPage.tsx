import { useEffect, useState } from 'react';
import type { AssistantThread, ConversationPick } from '../../assistantApi';
import { apiError } from '../../settingsApi';
import type { AiTier, Child } from '../../types';
import { useAsk, useAssistant, useConversations, useDeleteConversation } from '../../useAssistant';
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
 * دستیارِ هوشمندِ والدین: یک گفت‌وگوی تمام‌صفحه درباره‌ی فرزندِ انتخاب‌شده. بارِ اول آخرین گفت‌وگو باز می‌شود؛
 * «گفت‌وگوی تازه» صفحه را خالی می‌کند و اولین پرسش گفت‌وگوی تازه را می‌سازد. تاریخچه ویژه‌ی اشتراک است.
 */
export function AssistantPage({
  childId, childName, childList, onChildChange, guest = false, onUpgrade, onSupport, onLogin,
}: Props) {
  const [conversation, setConversation] = useState<ConversationPick>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const query = useAssistant(childId, conversation, !guest);
  const thread: AssistantThread | undefined = guest ? GUEST_THREAD : query.data;
  const history = useConversations(childId, historyOpen && !guest);
  const ask = useAsk(childId ?? '');
  const remove = useDeleteConversation(childId ?? '');
  const [tier, setTier] = useState<AiTier>('flash');
  const [draft, setDraft] = useState('');

  const tiers = thread?.quota.tiers ?? [];
  const active = tiers.find((item) => item.key === tier) ?? tiers[0];
  const pending = Boolean(thread?.pending) || ask.isPending;

  // فرزندِ دیگر: از آخرین گفت‌وگوی خودش شروع کن
  useEffect(() => {
    setConversation(null);
    setHistoryOpen(false);
  }, [childId]);

  // اگر سطحِ انتخاب‌شده برای این فرزند قفل است، به «لوکو سریع» برگرد
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
    if (!clean || !canAsk || clean.length > (thread?.questionMax ?? 1000)) return;
    ask.mutate({ text: clean, tier: useTier, conversation: thread?.conversation?.id }, {
      onSuccess: (result) => {
        setDraft('');
        setConversation(result.conversation.id);
      },
    });
  };

  const deleteConversation = (id?: number) => {
    remove.mutate(id, {
      onSuccess: () => {
        if (!id || id === thread?.conversation?.id) setConversation(null);
      },
    });
  };

  if (!guest && query.isLoading) return <div className={styles.loading} aria-hidden><i /><i /></div>;
  if (!thread) {
    return (
      <div className={styles.state}>
        <p>{query.error ? apiError(query.error, 'دستیار بارگذاری نشد. اتصال را بررسی کنید.') : 'دستیار بارگذاری نشد.'}</p>
        <button type="button" onClick={() => (conversation === null ? void query.refetch() : setConversation(null))}>
          تلاشِ دوباره
        </button>
      </div>
    );
  }
  return (
    <AssistantChat thread={thread} childName={childName} childList={childList} activeChildId={childId}
      onChildChange={onChildChange} guest={guest} tier={active?.key ?? 'flash'} onTier={setTier}
      draft={draft} onDraft={setDraft} onAsk={send}
      sending={ask.isPending && ask.variables ? ask.variables.text : null}
      error={ask.isError ? apiError(ask.error, 'پرسش فرستاده نشد؛ دوباره تلاش کنید.') : ''}
      pending={pending} onClear={() => deleteConversation(thread.conversation?.id)} clearing={remove.isPending}
      onNewChat={() => { setConversation('new'); setDraft(''); ask.reset(); }}
      history={history.data} historyLoading={history.isLoading} onOpenHistory={() => setHistoryOpen(true)}
      onPickConversation={(id) => { setConversation(id); ask.reset(); }}
      onDeleteConversation={(id) => deleteConversation(id)}
      onUpgrade={onUpgrade} onSupport={onSupport} onLogin={onLogin} />
  );
}
