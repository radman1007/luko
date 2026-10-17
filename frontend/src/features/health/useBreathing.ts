import { useCallback, useEffect, useRef, useState } from 'react';
import { isGuestMode } from '@/features/auth/guest';
import { completeMission } from '@/features/club/store';
import { breathingApi } from './api';

export type BreathPhase = 'rest' | 'inhale' | 'hold' | 'exhale';

const PHASE_SECONDS: Record<Exclude<BreathPhase, 'rest'>, number> = {
  inhale: 4,
  hold: 4,
  exhale: 4,
};

const PHASE_ORDER: Exclude<BreathPhase, 'rest'>[] = ['inhale', 'hold', 'exhale'];

/**
 * تمرینی که دستِ‌کم یک دورِ کامل داشته به سرور می‌رود تا در پنلِ والد دیده شود؛ تا ۲۵ مهر ۱۴۰۵ فقط مأموریتِ
 * روز تیک می‌خورد و تنفس هیچ‌جا ثبت نمی‌شد. بی‌اینترنت گم می‌شود، ولی مأموریتِ «نفس جادویی» با هم‌رسانی
 * می‌رسد و سرور از آن دستِ‌کم یک تمرینِ آن روز را می‌سازد (apps/sync/derived.py).
 */
function report(cycles: number, startedAt: number) {
  if (cycles < 1 || isGuestMode()) return;
  const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  void breathingApi.save({ cycles, seconds }).catch(() => undefined);
}

/** تمرین تنفس هدایت‌شده ۴-۴-۴: دم، نگه‌داشتن، بازدم */
export function useBreathing() {
  const [phase, setPhase] = useState<BreathPhase>('rest');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cyclesDone, setCyclesDone] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** تمرینِ در جریان: کِی شروع شد و چند دورِ کامل رفت */
  const session = useRef<{ startedAt: number; cycles: number } | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (session.current) report(session.current.cycles, session.current.startedAt);
    session.current = null;
    setPhase('rest');
    setSecondsLeft(0);
  }, []);

  const start = useCallback(() => {
    stop();
    session.current = { startedAt: Date.now(), cycles: 0 };
    setCyclesDone(0);
    let phaseIndex = 0;
    let remaining = PHASE_SECONDS[PHASE_ORDER[0]];
    setPhase(PHASE_ORDER[0]);
    setSecondsLeft(remaining);

    timer.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }
      phaseIndex += 1;
      if (phaseIndex === PHASE_ORDER.length) {
        phaseIndex = 0;
        if (session.current) session.current.cycles += 1;
        setCyclesDone((c) => c + 1);
        // یک دورِ کاملِ دم‌ونگه‌داشتن‌وبازدم = مأموریتِ «نفس جادویی»
        completeMission('breath');
      }
      remaining = PHASE_SECONDS[PHASE_ORDER[phaseIndex]];
      setPhase(PHASE_ORDER[phaseIndex]);
      setSecondsLeft(remaining);
    }, 1000);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { phase, secondsLeft, cyclesDone, running: phase !== 'rest', start, stop };
}
