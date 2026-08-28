import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { completedLevelIds, replaceCompletedLevelIds } from '@/features/books/booksData';
import { isGuestMode } from '@/features/auth/guest';
import { gamesApi } from './api';

/**
 * پیشرفتِ مسیرِ سیزن، هم‌راستا با سرور.
 *
 * قفلِ پشتِ‌سرهم دو جا اعمال می‌شود: در UI و در سرویسی که سکه می‌دهد. اگر
 * این دو یکی نباشند — مثلاً بچه روی گوشیِ تازه وارد شود و localStorage خالی
 * باشد — نقشه چیزی نشان می‌دهد که سرور قبول نمی‌کند. پس فهرستِ سرور جایگزینِ
 * محلی می‌شود، و فقط وقتی درخواست موفق بوده؛ در قطعیِ شبکه محلی سرِ جایش می‌ماند.
 *
 * مهمان حسابِ سروری ندارد، پس همان پیشرفتِ محلی‌اش می‌ماند.
 */
export function useSeasonProgress(): Set<string> {
  const guest = isGuestMode();

  const { data } = useQuery({
    queryKey: ['games', 'completed'],
    queryFn: async () => {
      const slugs = await gamesApi.completedSlugs();
      replaceCompletedLevelIds(slugs);
      return slugs;
    },
    enabled: !guest,
    staleTime: 30_000,
  });

  // ارجاعِ Set باید پایدار بماند، وگرنه useMemoهای پایین‌دست (چیدمانِ نقشه)
  // در هر رندر دوباره حساب می‌شوند.
  return useMemo(() => new Set(data ?? completedLevelIds()), [data]);
}
