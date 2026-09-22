import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { profileApi } from './api';

const TREASURE_KEY = 'luko_treasures';

/**
 * گنج‌های گمشده‌ی شهر — ارز ویژه‌ی کارگاه لوکوریان‌سازی.
 * جدا از سکه‌ی معمولی و بسیار کمیاب‌تر.
 *
 * گنج را سرور از دستاوردها می‌دهد (مثلاً تمام‌کردنِ یک کتاب)؛ پس برای بچه‌ی
 * واردشده عددِ سرور نشان داده می‌شود — همان روی همه‌ی دستگاه‌هایش. قبلاً
 * عددی محلی خوانده می‌شد که چیزی بالایش نمی‌برد و هر دستگاه صفرِ خودش را
 * داشت. مهمان حسابِ سروری ندارد و همان نسخه‌ی محلی را دارد.
 */
export function useTreasure() {
  const guest = isGuestMode();
  const server = useQuery({
    queryKey: ['treasures'],
    queryFn: profileApi.treasures,
    enabled: !guest,
    staleTime: 60_000,
  });
  const [local, setLocal] = useState<number>(() => Number(localStorage.getItem(TREASURE_KEY)) || 0);

  const earn = useCallback((amount: number) => {
    setLocal((prev) => {
      const next = prev + amount;
      localStorage.setItem(TREASURE_KEY, String(next));
      return next;
    });
  }, []);

  const spend = useCallback(
    (amount: number): boolean => {
      if (local < amount) return false;
      const next = local - amount;
      setLocal(next);
      localStorage.setItem(TREASURE_KEY, String(next));
      return true;
    },
    [local],
  );

  return { treasures: guest ? local : (server.data ?? 0), earn, spend };
}
