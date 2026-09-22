import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { completedLevelIds, replaceCompletedLevelIds } from './localProgress';
import { isGuestMode } from '@/features/auth/guest';
import { gamesApi } from './api';
import { pendingSlugs } from './pendingCompletions';

export interface SeasonProgress {
  /** شناسه‌ی مرحله‌های تمام‌شده */
  done: Set<string>;
  /** بهترین ستاره‌ی هر مرحله */
  stars: Record<string, number>;
}

/**
 * پیشرفتِ مسیرِ سیزن، هم‌راستا با سرور.
 *
 * قفلِ پشتِ‌سرهم دو جا اعمال می‌شود: در UI و در سرویسی که سکه می‌دهد. اگر
 * این دو یکی نباشند — مثلاً بچه روی گوشیِ تازه وارد شود و localStorage خالی
 * باشد — نقشه چیزی نشان می‌دهد که سرور قبول نمی‌کند. پس فهرستِ سرور جایگزینِ
 * محلی می‌شود، و فقط وقتی درخواست موفق بوده؛ در قطعیِ شبکه محلی سرِ جایش می‌ماند.
 *
 * ستاره‌ها فقط سروری‌اند: نسخه‌ی محلی ندارند چون معیارِ دستاوردند و
 * دست‌کاریِ localStorage نباید سه‌ستاره‌شان کند.
 *
 * مهمان حسابِ سروری ندارد، پس همان پیشرفتِ محلی‌اش می‌ماند.
 *
 * مرحله‌هایی که بی‌اینترنت برده شده‌اند و هنوز در صفِ ارسال‌اند
 * (`pendingCompletions`) هم «رفته» حساب می‌شوند: سرور هنوز ندیده‌شان ولی
 * خواهد دید، و بدونِ این بچه‌ی آفلاین پشتِ همان مرحله قفل می‌ماند.
 */
export function useSeasonProgress(): SeasonProgress {
  const guest = isGuestMode();

  const { data } = useQuery({
    queryKey: ['games', 'completed'],
    queryFn: async () => {
      const progress = await gamesApi.progress();
      replaceCompletedLevelIds([...new Set([...progress.completed, ...pendingSlugs()])]);
      return progress;
    },
    enabled: !guest,
    staleTime: 30_000,
  });

  // ارجاعِ Set باید پایدار بماند، وگرنه useMemoهای پایین‌دست (چیدمانِ نقشه)
  // در هر رندر دوباره حساب می‌شوند.
  return useMemo(
    () => ({
      done: new Set([...(data?.completed ?? completedLevelIds()), ...pendingSlugs()]),
      stars: data?.stars ?? {},
    }),
    [data],
  );
}
