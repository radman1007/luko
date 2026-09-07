import { useEffect, useMemo } from 'react';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew } from '@/features/garden/store';
import { useDrawings } from '@/features/health/useDrawings';
import { useSeasonProgress } from '@/features/games/useSeasonProgress';
import { useTreasure } from '@/features/profile/useTreasure';
import { buildMedals } from './medals';
import type { Medal } from './medals';
import { useClub } from './useClub';

const MEDAL_DEW_KEY = 'luko_medal_dew';

/** یک‌بار پاداشِ هر مدال — کلیدها ثابت‌اند تا دوباره پاداش داده نشود */
function rewardOnce(medals: Medal[]): void {
  let rewarded: string[] = [];
  try {
    rewarded = JSON.parse(localStorage.getItem(MEDAL_DEW_KEY) ?? '[]') as string[];
  } catch {
    /* داده‌ی خراب → از صفر */
  }
  const newly = medals.filter((m) => m.unlocked && !rewarded.includes(m.id));
  if (newly.length === 0) return;
  newly.forEach(() => grantDew(DEW_REWARD.medal, 'medal'));
  try {
    localStorage.setItem(MEDAL_DEW_KEY, JSON.stringify([...rewarded, ...newly.map((m) => m.id)]));
  } catch {
    /* حافظه پر/غیرفعال — پاداش داده شد، فقط دوباره هم داده می‌شود */
  }
}

/**
 * مدال‌ها با آمارِ کامل.
 *
 * چهار منبع دارند: کلاب (مأموریت، پشتکار، خرید، سکه)، مسیرِ سیزن (بازی و
 * ستاره)، گالری (نقاشی) و گنج. تا دیروز محاسبه داخلِ `useClub` بود که
 * فقط منبعِ اول را می‌دید — یعنی مدالِ بازی در صفحهٔ کلاب قفل دیده می‌شد
 * و در پروفایل باز. یک‌جا کردنشان همان ناسازگاری را می‌بندد.
 *
 * پاداشِ شبنم هم این‌جاست، نه در کلاب: آن‌جا برای مدالی که نمی‌توانست
 * ارزیابی‌اش کند هیچ‌وقت پاداش نمی‌داد.
 */
export function useMedals(): Medal[] {
  const club = useClub();
  const progress = useSeasonProgress();
  const { drawings } = useDrawings();
  const { treasures } = useTreasure();

  const medals = useMemo(
    () =>
      buildMedals({
        totalTasks: club.total,
        streak: club.streak,
        purchases: club.owned.length,
        coins: club.coins,
        games: progress.done.size,
        stars: Object.values(progress.stars).reduce((sum, n) => sum + n, 0),
        drawings: drawings.length,
        treasures,
      }),
    [club.total, club.streak, club.owned, club.coins, progress, drawings, treasures],
  );

  useEffect(() => rewardOnce(medals), [medals]);

  return medals;
}
