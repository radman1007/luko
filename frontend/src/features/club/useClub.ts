import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  HiOutlineFire,
  HiOutlineRocketLaunch,
  HiOutlineShoppingBag,
  HiOutlineStar,
} from 'react-icons/hi2';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew } from '@/features/garden/store';
import { buy, completeMission, completeSportTask, getSnapshot, subscribe } from './store';
import type { Medal } from './types';

const MEDAL_DEW_KEY = 'luko_medal_dew';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* داده‌ی خراب → مقدار پیش‌فرض */
  }
  return fallback;
}

/** روزهای پیاپیِ دارای مأموریتِ انجام‌شده (اگر امروز هنوز نه، از دیروز می‌شمارد) */
function calcStreak(days: string[]): number {
  const set = new Set(days);
  const cursor = new Date();
  let streak = 0;
  if (!set.has(cursor.toLocaleDateString('en-CA'))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(cursor.toLocaleDateString('en-CA'))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * وضعیت باشگاه برای UI. نوشتن در استورِ ماژولی است، چون مأموریت‌ها را
 * بخش‌های دیگرِ اپ ثبت می‌کنند نه دکمه‌ای در همین صفحه.
 */
export function useClub() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { coins, doneToday, sportDoneToday, days, total, owned } = state;

  const streak = useMemo(() => calcStreak(days), [days]);

  const medals: Medal[] = useMemo(
    () => [
      {
        id: 'first',
        title: 'اولین قدم',
        description: 'اولین مأموریتت رو انجام دادی',
        icon: HiOutlineStar,
        unlocked: total >= 1,
      },
      {
        id: 'streak3',
        title: 'سه روز آتشین',
        description: '۳ روز پشت سر هم تمرین کردی',
        icon: HiOutlineFire,
        unlocked: streak >= 3,
      },
      {
        id: 'ten',
        title: 'ده‌تایی شدی',
        description: '۱۰ مأموریت کامل کردی',
        icon: HiOutlineRocketLaunch,
        unlocked: total >= 10,
      },
      {
        id: 'buyer',
        title: 'خریدار باشگاه',
        description: 'اولین جایزه‌ت رو خریدی',
        icon: HiOutlineShoppingBag,
        unlocked: owned.length > 0,
      },
    ],
    [total, streak, owned],
  );

  // برای هر مدالِ تازه‌بازشده یک بار شبنم می‌دهد (پاداش باغچه)
  useEffect(() => {
    const rewarded = readJSON<string[]>(MEDAL_DEW_KEY, []);
    const newly = medals.filter((m) => m.unlocked && !rewarded.includes(m.id));
    if (newly.length === 0) return;
    newly.forEach(() => grantDew(DEW_REWARD.medal, 'medal'));
    localStorage.setItem(MEDAL_DEW_KEY, JSON.stringify([...rewarded, ...newly.map((m) => m.id)]));
  }, [medals]);

  return {
    coins,
    doneToday,
    sportDoneToday,
    days,
    streak,
    medals,
    owned,
    buy,
    completeMission,
    completeSportTask,
    /** کل مأموریت‌های انجام‌شده از ابتدا (کلاب + ورزش) */
    total,
  };
}
