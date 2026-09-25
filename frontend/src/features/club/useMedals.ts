import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew } from '@/features/garden/store';
import { useDrawings } from '@/features/health/useDrawings';
import { useCompletedStages, useSeasonProgress } from '@/features/games/useSeasonProgress';
import { useTreasure } from '@/features/profile/useTreasure';
import { useStorageChange } from '@/lib/useStorageChange';
import { buildMedals } from './medals';
import type { Medal } from './medals';
import { useClub } from './useClub';

/**
 * مدال‌هایی که بچه یک‌بار گرفته (و شبنمِ پاداششان داده شده). نامِ کلید از
 * زمانی مانده که فقط برای پاداش بود؛ حالا «گرفته‌شده»ی همیشگی هم هست و با
 * حساب هم‌رسان می‌شود (`features/sync`)، پس روی دستگاهِ تازه هم می‌ماند.
 */
const EARNED_KEY = 'luko_medal_dew';

function readEarned(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(EARNED_KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return []; // داده‌ی خراب → از صفر
  }
}

/** یک‌بار پاداشِ هر مدال — کلیدها ثابت‌اند تا دوباره پاداش داده نشود */
function rewardOnce(medals: Medal[]): void {
  const rewarded = readEarned();
  const newly = medals.filter((m) => m.unlocked && !rewarded.includes(m.id));
  if (newly.length === 0) return;
  newly.forEach(() => grantDew(DEW_REWARD.medal));
  try {
    localStorage.setItem(EARNED_KEY, JSON.stringify([...rewarded, ...newly.map((m) => m.id)]));
  } catch {
    /* حافظه پر/غیرفعال — پاداش داده شد، فقط دوباره هم داده می‌شود */
  }
}

const isEarnedKey = (key: string) => key === EARNED_KEY;

/**
 * مدال‌ها با آمارِ کامل.
 *
 * چهار منبع دارند: کلاب (مأموریت، پشتکار، خرید، سکه)، مسیرِ سیزن (بازی و
 * ستاره)، گالری (نقاشی) و گنج. نمایششان فقط در تالارِ افتخاراتِ پروفایل
 * است؛ ولی پاداشِ شبنمِ مدالِ تازه باید همان روز برسد نه روزی که بچه پروفایل
 * را باز کرد، پس `StudentLayout` هم این را صدا می‌زند (`useMedalRewards`).
 *
 * «بازی‌ها» فقط مرحله‌های مسیرِ کلاسِ خودِ بچه است — همان عددی که نقشه و
 * پروفایل می‌گویند.
 */
export function useMedals(): Medal[] {
  const club = useClub();
  const progress = useSeasonProgress();
  const games = useCompletedStages();
  const { drawings } = useDrawings();
  const { treasures } = useTreasure();

  const [earned, setEarned] = useState(readEarned);
  const refresh = useCallback(() => setEarned(readEarned()), []);
  useStorageChange(isEarnedKey, refresh);

  const medals = useMemo(
    () =>
      buildMedals(
        {
          totalTasks: club.total,
          streak: club.streak,
          purchases: club.owned.length,
          coins: club.coins,
          games,
          stars: Object.values(progress.stars).reduce((sum, n) => sum + n, 0),
          drawings: drawings.length,
          treasures,
        },
        new Set(earned),
      ),
    [club.total, club.streak, club.owned, club.coins, games, progress.stars, drawings, treasures, earned],
  );

  useEffect(() => {
    rewardOnce(medals);
    // همین صفحه هم «گرفته‌شده» را ببیند (رویدادِ storage فقط برای بقیه‌ی تب‌هاست)
    setEarned((prev) => {
      const next = readEarned();
      return next.length === prev.length ? prev : next;
    });
  }, [medals]);

  return medals;
}

/** پاداشِ مدال‌های تازه در هر صفحه‌ی بچه — بی‌آنکه چیزی نشان داده شود */
export function useMedalRewards(): void {
  useMedals();
}
