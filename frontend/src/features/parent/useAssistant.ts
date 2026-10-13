/**
 * گفت‌وگوی دستیار. پاسخ در صفِ سرور ساخته می‌شود؛ تا وقتی پیامی «در حالِ پاسخ» است، گفت‌وگو هر
 * دو ثانیه دوباره خوانده می‌شود (سرور پیامِ گم‌شده را بعد از چند دقیقه می‌بندد).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantApi } from './assistantApi';
import type { AssistantThread } from './assistantApi';
import type { AiTier } from './types';

const key = (childId: string) => ['parent', 'assistant', childId] as const;

export function useAssistant(childId?: string, enabled = true) {
  return useQuery({
    queryKey: key(childId ?? ''),
    queryFn: () => assistantApi.thread(childId as string),
    enabled: enabled && Boolean(childId),
    refetchInterval: (query) => (query.state.data?.pending ? 2000 : false),
  });
}

export function useAsk(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ text, tier }: { text: string; tier: AiTier }) => assistantApi.ask(childId, text, tier),
    onSuccess: (messages) => {
      client.setQueryData<AssistantThread>(key(childId), (old) =>
        old ? { ...old, messages: [...old.messages, ...messages], pending: true } : old);
      client.invalidateQueries({ queryKey: key(childId) });
    },
  });
}

export function useClearAssistant(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => assistantApi.clear(childId),
    onSuccess: () => client.invalidateQueries({ queryKey: key(childId) }),
  });
}
