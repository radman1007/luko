import { useMemo, useSyncExternalStore } from 'react';
import { buy, completeMission, completeSportTask, getSnapshot, subscribe } from './store';

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

  return {
    coins,
    doneToday,
    sportDoneToday,
    days,
    streak,
    owned,
    buy,
    completeMission,
    completeSportTask,
    /** کل مأموریت‌های انجام‌شده از ابتدا (کلاب + ورزش) */
    total,
  };
}
