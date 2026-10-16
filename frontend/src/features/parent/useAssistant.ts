/**
 * گفت‌وگوی دستیار. پاسخ در صفِ سرور ساخته می‌شود؛ تا وقتی پیامی «در حالِ پاسخ» است، گفت‌وگو هر
 * دو ثانیه دوباره خوانده می‌شود (سرور پیامِ گم‌شده را بعد از چند دقیقه می‌بندد).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantApi } from './assistantApi';
import type { ConversationPick } from './assistantApi';
import type { AiTier } from './types';

const all = (childId: string) => ['parent', 'assistant', childId] as const;
const key = (childId: string, conversation: ConversationPick) => [...all(childId), conversation ?? 'latest'] as const;
const listKey = (childId: string) => [...all(childId), 'conversations'] as const;

export function useAssistant(childId: string | undefined, conversation: ConversationPick, enabled = true) {
  return useQuery({
    queryKey: key(childId ?? '', conversation),
    queryFn: () => assistantApi.thread(childId as string, conversation),
    enabled: enabled && Boolean(childId),
    refetchInterval: (query) => (query.state.data?.pending ? 2000 : false),
  });
}

export function useAsk(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ text, tier, conversation }: { text: string; tier: AiTier; conversation?: number }) =>
      assistantApi.ask(childId, text, tier, conversation),
    onSuccess: () => client.invalidateQueries({ queryKey: all(childId) }),
  });
}

export function useConversations(childId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: listKey(childId ?? ''),
    queryFn: () => assistantApi.conversations(childId as string),
    enabled: enabled && Boolean(childId),
  });
}

export function useDeleteConversation(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (conversation?: number) => assistantApi.remove(childId, conversation),
    onSuccess: () => client.invalidateQueries({ queryKey: all(childId) }),
  });
}
