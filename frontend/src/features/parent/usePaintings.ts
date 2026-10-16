/**
 * نقاشی‌های بچه در پنلِ والد. تحلیل در صفِ سرور ساخته می‌شود؛ تا «در حالِ تحلیل» است، جزئیاتِ همان نقاشی هر
 * دو ثانیه دوباره خوانده می‌شود (سرور تحلیلِ گم‌شده را بعد از چند دقیقه می‌بندد).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paintingsApi } from './paintingsApi';

const listKey = (childId: string) => ['parent', 'paintings', childId] as const;
const detailKey = (childId: string, id: number) => ['parent', 'paintings', childId, id] as const;

export function usePaintings(childId?: string) {
  return useQuery({
    queryKey: listKey(childId ?? ''),
    queryFn: () => paintingsApi.list(childId as string),
    enabled: Boolean(childId),
  });
}

export function usePainting(childId: string | undefined, id: number | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: detailKey(childId ?? '', id ?? 0),
    queryFn: async () => {
      const detail = await paintingsApi.detail(childId as string, id as number);
      // وضعیتِ تازه‌ی تحلیل روی کارتِ گالری هم بنشیند
      if (detail.analysis?.status !== 'pending') void client.invalidateQueries({ queryKey: listKey(childId as string), exact: true });
      return detail;
    },
    enabled: Boolean(childId) && id !== null,
    refetchInterval: (query) => (query.state.data?.analysis?.status === 'pending' ? 2000 : false),
  });
}

export function useAnalyzePainting(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => paintingsApi.analyze(childId, id),
    onSuccess: (detail) => {
      client.setQueryData(detailKey(childId, detail.id), detail);
      void client.invalidateQueries({ queryKey: listKey(childId), exact: true });
    },
  });
}
