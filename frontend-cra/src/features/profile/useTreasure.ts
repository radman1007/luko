import { useCallback, useState } from 'react';

const TREASURE_KEY = 'luko_treasures';

/**
 * گنج‌های گمشده‌ی شهر — ارز ویژه‌ی کارگاه لوکوریان‌سازی.
 * جدا از سکه‌ی معمولی و بسیار کمیاب‌تر. (TODO: sync با بک‌اند)
 */
export function useTreasure() {
  const [treasures, setTreasures] = useState<number>(
    () => Number(localStorage.getItem(TREASURE_KEY)) || 0,
  );

  const earn = useCallback((amount: number) => {
    setTreasures((prev) => {
      const next = prev + amount;
      localStorage.setItem(TREASURE_KEY, String(next));
      return next;
    });
  }, []);

  const spend = useCallback(
    (amount: number): boolean => {
      if (treasures < amount) return false;
      const next = treasures - amount;
      setTreasures(next);
      localStorage.setItem(TREASURE_KEY, String(next));
      return true;
    },
    [treasures],
  );

  return { treasures, earn, spend };
}
