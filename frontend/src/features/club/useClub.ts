import { useCallback, useMemo, useState } from 'react';
import {
  HiOutlineFire,
  HiOutlineRocketLaunch,
  HiOutlineShoppingBag,
  HiOutlineStar,
} from 'react-icons/hi2';
import { DAILY_MISSIONS, SPORT_TASKS } from './clubData';
import type { Medal, Mission } from './types';

const COINS_KEY = 'luko_coins';
const DAYS_KEY = 'luko_club_days';
const TOTAL_KEY = 'luko_club_total';
const OWNED_KEY = 'luko_club_owned';

const doneKey = (day: string) => `luko_club_done_${day}`;
const sportDoneKey = (day: string) => `luko_sport_done_${day}`;
const todayStr = () => new Date().toLocaleDateString('en-CA');

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

/** وضعیت باشگاه: سکه، مأموریت‌های امروز، استریک، مدال‌ها و خریدها (TODO: sync با بک‌اند) */
export function useClub() {
  const [coins, setCoins] = useState<number>(() => {
    const raw = localStorage.getItem(COINS_KEY);
    if (raw !== null) return Number(raw) || 0;
    localStorage.setItem(COINS_KEY, '120'); // موجودی اولیه‌ی دمو
    return 120;
  });
  const [doneToday, setDoneToday] = useState<string[]>(() => readJSON(doneKey(todayStr()), []));
  const [sportDoneToday, setSportDoneToday] = useState<string[]>(() =>
    readJSON(sportDoneKey(todayStr()), []),
  );
  const [days, setDays] = useState<string[]>(() => readJSON(DAYS_KEY, []));
  const [total, setTotal] = useState<number>(() => Number(localStorage.getItem(TOTAL_KEY)) || 0);
  const [owned, setOwned] = useState<string[]>(() => readJSON(OWNED_KEY, []));

  /** تکمیل مأموریت از هر لیست: سکه + شمارنده‌ی کل + لاگ روز (پایه‌ی استریک) */
  const completeFrom = useCallback(
    (
      list: Mission[],
      done: string[],
      setDone: (v: string[]) => void,
      keyOf: (day: string) => string,
      taskId: string,
    ) => {
      if (done.includes(taskId)) return;
      const task = list.find((m) => m.id === taskId);
      if (!task) return;

      const day = todayStr();
      const nextDone = [...done, taskId];
      const nextCoins = coins + task.coinReward;
      const nextTotal = total + 1;
      const nextDays = days.includes(day) ? days : [...days, day];

      setDone(nextDone);
      setCoins(nextCoins);
      setTotal(nextTotal);
      setDays(nextDays);

      localStorage.setItem(keyOf(day), JSON.stringify(nextDone));
      localStorage.setItem(COINS_KEY, String(nextCoins));
      localStorage.setItem(TOTAL_KEY, String(nextTotal));
      localStorage.setItem(DAYS_KEY, JSON.stringify(nextDays));
    },
    [coins, days, total],
  );

  const completeMission = useCallback(
    (missionId: string) =>
      completeFrom(DAILY_MISSIONS, doneToday, setDoneToday, doneKey, missionId),
    [completeFrom, doneToday],
  );

  const completeSportTask = useCallback(
    (taskId: string) =>
      completeFrom(SPORT_TASKS, sportDoneToday, setSportDoneToday, sportDoneKey, taskId),
    [completeFrom, sportDoneToday],
  );

  const buy = useCallback(
    (itemId: string, cost: number): boolean => {
      if (owned.includes(itemId) || coins < cost) return false;
      const nextCoins = coins - cost;
      const nextOwned = [...owned, itemId];
      setCoins(nextCoins);
      setOwned(nextOwned);
      localStorage.setItem(COINS_KEY, String(nextCoins));
      localStorage.setItem(OWNED_KEY, JSON.stringify(nextOwned));
      return true;
    },
    [coins, owned],
  );

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

  return {
    coins,
    doneToday,
    completeMission,
    sportDoneToday,
    completeSportTask,
    days,
    streak,
    medals,
    owned,
    buy,
    /** کل مأموریت‌های انجام‌شده از ابتدا (کلاب + ورزش) */
    total,
  };
}
