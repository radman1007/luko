import { useEffect, useRef } from 'react';
import { DEW_REWARD, TIME_DEW } from './gardenData';
import { grantDew } from './store';

const dayKey = () => `luko_dew_time_${new Date().toLocaleDateString('en-CA')}`;

function givenToday(): number {
  return Number(localStorage.getItem(dayKey())) || 0;
}

/**
 * شبنمِ «زمان حضور»: هر بازه‌ی حضورِ فعال در سایت مقداری شبنم می‌دهد،
 * با سقف روزانه. زمانی که تب مخفی است حساب نمی‌شود. یک بار در ریشه‌ی اپ نصب می‌شود.
 */
export function useSiteTimeDew() {
  const accMs = useRef(0);
  const lastAt = useRef(Date.now());

  useEffect(() => {
    lastAt.current = Date.now();

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        // سقف روی دلتا تا خوابِ سیستم/تبِ معلق به‌اشتباه شمرده نشود
        accMs.current += Math.min(now - lastAt.current, 30_000);
      }
      lastAt.current = now;

      while (accMs.current >= TIME_DEW.chunkMs) {
        accMs.current -= TIME_DEW.chunkMs;
        if (givenToday() >= TIME_DEW.dailyCap) continue; // سقف روزانه پر شده
        grantDew(DEW_REWARD.time, 'time');
        localStorage.setItem(dayKey(), String(givenToday() + DEW_REWARD.time));
      }
    };

    const id = setInterval(tick, 20_000);
    const onVisible = () => {
      lastAt.current = Date.now(); // بازگشت به تب: زمانِ مخفی‌بودن شمرده نشود
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
