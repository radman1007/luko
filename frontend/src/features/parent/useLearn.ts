/** صفحه‌ی «آموزش»: فهرست، یک محتوا و ثبتِ ذخیره/تمام‌شدن (خوش‌بینانه، تا دکمه‌ها بی‌درنگ باشند) */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learnApi } from './learnApi';
import type { LearnDetail, LearnList, LearnProgressBody } from './learnApi';

const MINUTE = 60 * 1000;
const listKey = (childId?: string) => ['parent', 'learn', 'list', childId ?? ''] as const;
const itemKey = (id: number) => ['parent', 'learn', 'item', id] as const;

export function useLearnList(childId?: string, enabled = true) {
  return useQuery({ queryKey: listKey(childId), queryFn: () => learnApi.list(childId), enabled, staleTime: 2 * MINUTE });
}

export function useLearnItem(id: number, enabled = true) {
  return useQuery({ queryKey: itemKey(id), queryFn: () => learnApi.item(id), enabled: enabled && id > 0 });
}

export function useLearnProgress() {
  const client = useQueryClient();
  const patch = (id: number, body: LearnProgressBody) => {
    const flags = { ...(body.saved !== undefined && { saved: body.saved }), ...(body.done !== undefined && { done: body.done }) };
    if (!Object.keys(flags).length) return;
    client.setQueryData<LearnDetail>(itemKey(id), (old) => (old ? { ...old, ...flags } : old));
    client.setQueriesData<LearnList>({ queryKey: ['parent', 'learn', 'list'] }, (old) => old && {
      ...old,
      items: old.items.map((item) => (item.id === id ? { ...item, ...flags } : item)),
    });
  };
  return useMutation({
    mutationFn: ({ id, ...body }: LearnProgressBody & { id: number }) => learnApi.progress(id, body),
    onMutate: ({ id, ...body }) => patch(id, body),
    onError: (_error, { id }) => {
      client.invalidateQueries({ queryKey: itemKey(id) });
      client.invalidateQueries({ queryKey: ['parent', 'learn', 'list'] });
    },
  });
}
