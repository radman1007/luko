import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { tokenStorage } from '@/lib/api';
import { cacheOwner } from '@/lib/queryClient';
import { noticesApi } from './api';
import type { KidNoticeList } from './api';

const EMPTY: KidNoticeList = { items: [], unread: 0 };

/**
 * صندوقِ پیام‌های بچه — اعلان‌هایی که تیم از داشبورد می‌فرستد. مهمان حسابی ندارد و
 * صندوق هم ندارد. هر دو دقیقه و با برگشتن به صفحه تازه می‌شود.
 */
export function useKidNotices() {
  const queryClient = useQueryClient();
  const enabled = !isGuestMode() && Boolean(tokenStorage.get('kid'));
  const key = ['notices', cacheOwner() ?? 'anon'];
  const query = useQuery({
    queryKey: key,
    queryFn: noticesApi.list,
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: noticesApi.markRead,
    onSuccess: () => queryClient.setQueryData<KidNoticeList>(key, (old) =>
      old ? { items: old.items.map((n) => ({ ...n, isRead: true })), unread: 0 } : old),
  });
  return { enabled, data: query.data ?? EMPTY, isLoading: query.isLoading, markRead: markRead.mutate };
}
