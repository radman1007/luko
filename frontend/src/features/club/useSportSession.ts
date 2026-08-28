import { useCallback, useEffect, useRef, useState } from 'react';
import { completeSportTask } from './store';
import type { SportTask } from './types';

export type SessionPhase = 'running' | 'paused' | 'done';

const TICK_MS = 250;
/**
 * سقفِ هر گام. مرورگر تایمرِ تبِ پس‌زمینه را کند می‌کند و خوابِ دستگاه هم
 * فاصله می‌اندازد؛ با شمردنِ زمانِ واقعی (نه تعدادِ تیک) تمرین درست
 * اندازه‌گیری می‌شود و این سقف جلوی پرشِ ناگهانی را می‌گیرد.
 */
const MAX_STEP_S = 1.5;

const visiblePhase = (): SessionPhase =>
  document.visibilityState === 'visible' ? 'running' : 'paused';

/**
 * تمرینِ هدایت‌شده.
 *
 * زمان فقط وقتی جلو می‌رود که تبِ اپ جلوی چشمِ بچه باشد؛ با پنهان‌شدنِ صفحه
 * مکث می‌کند و با برگشتن ادامه می‌دهد. یعنی نمی‌شود تمرین را باز گذاشت و
 * رفت — امتیاز وقتی می‌آید که واقعاً همان‌قدر زمان جلوی تمرین گذشته باشد.
 */
export function useSportSession(task: SportTask | null, onFinished?: () => void) {
  const [elapsed, setElapsed] = useState(0);
  // اگر صفحه از همان اول مخفی باشد باید «مکث» نشان دهد، نه «در حال اجرا»
  const [phase, setPhase] = useState<SessionPhase>(visiblePhase);
  const awarded = useRef(false);
  const lastAt = useRef(Date.now());
  // مقدارِ مرجع در ref می‌ماند تا محاسبه بیرون از تابعِ به‌روزرسانیِ state
  // انجام شود؛ آن تابع باید خالص باشد و React ممکن است حین رندر صدایش بزند.
  const elapsedRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    setPhase(visiblePhase());
    awarded.current = false;
    elapsedRef.current = 0;
    lastAt.current = Date.now();
  }, [task?.id]);

  useEffect(() => {
    if (!task) return undefined;

    // تمام‌شده را دست نمی‌زنیم؛ بقیه‌ی حالت‌ها دنبالِ نمایانیِ صفحه‌اند
    const sync = () => setPhase((p) => (p === 'done' ? p : visiblePhase()));
    sync();
    document.addEventListener('visibilitychange', sync);

    const id = window.setInterval(() => {
      // ساعت همیشه جلو می‌رود تا زمانِ مخفی‌بودن بعداً به حساب نیاید
      const now = Date.now();
      const step = Math.min((now - lastAt.current) / 1000, MAX_STEP_S);
      lastAt.current = now;
      if (document.visibilityState !== 'visible' || awarded.current) return;

      const next = Math.min(task.seconds, elapsedRef.current + step);
      elapsedRef.current = next;
      setElapsed(next);

      if (next >= task.seconds) {
        awarded.current = true;
        setPhase('done');
        completeSportTask(task.id);
        onFinished?.();
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [task, onFinished]);

  const reset = useCallback(() => {
    setElapsed(0);
    setPhase(visiblePhase());
    awarded.current = false;
    elapsedRef.current = 0;
    lastAt.current = Date.now();
  }, []);

  const secondsLeft = task ? Math.max(0, Math.ceil(task.seconds - elapsed)) : 0;
  const progress = task ? Math.min(1, elapsed / task.seconds) : 0;
  // تمرینِ شمارشی: تکرارِ چندم را می‌شمارد
  const repDone = task?.reps ? Math.min(task.reps, Math.floor(progress * task.reps)) : undefined;

  return { phase, secondsLeft, progress, repDone, reset };
}
