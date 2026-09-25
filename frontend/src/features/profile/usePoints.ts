import { useQuery } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { MOCK_STATS } from '@/features/home/mockData';
import { profileApi } from './api';

/**
 * «امتیازِ» بچه — عددِ سرور، همان روی همه‌ی دستگاه‌ها.
 *
 * قبلاً برای همه عددِ ثابتِ ۴۵۰ نشان داده می‌شد؛ بچه‌ای که همین حالا حساب
 * ساخته بود با ۴۵۰ امتیاز شروع می‌کرد. مهمان حسابِ سروری ندارد و همان عددِ
 * نمایشی را می‌بیند. پاسخ برای بازشدنِ بی‌اینترنت ذخیره می‌شود (`queryPersist`)
 * و بعد از ثبتِ هر مرحله تازه می‌شود (`pendingCompletions`).
 */
export function usePoints(): number {
  const guest = isGuestMode();
  const { data } = useQuery({
    queryKey: ['profile', 'stats'],
    queryFn: profileApi.stats,
    enabled: !guest,
    staleTime: 60_000,
  });
  if (guest) return MOCK_STATS.xp;
  return data?.points ?? 0;
}
