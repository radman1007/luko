import { useCallback, useEffect, useRef, useState } from 'react';

export type BreathPhase = 'rest' | 'inhale' | 'hold' | 'exhale';

const PHASE_SECONDS: Record<Exclude<BreathPhase, 'rest'>, number> = {
  inhale: 4,
  hold: 4,
  exhale: 4,
};

const PHASE_ORDER: Exclude<BreathPhase, 'rest'>[] = ['inhale', 'hold', 'exhale'];

/** تمرین تنفس هدایت‌شده ۴-۴-۴: دم، نگه‌داشتن، بازدم */
export function useBreathing() {
  const [phase, setPhase] = useState<BreathPhase>('rest');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cyclesDone, setCyclesDone] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPhase('rest');
    setSecondsLeft(0);
  }, []);

  const start = useCallback(() => {
    stop();
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
        setCyclesDone((c) => c + 1);
      }
      remaining = PHASE_SECONDS[PHASE_ORDER[phaseIndex]];
      setPhase(PHASE_ORDER[phaseIndex]);
      setSecondsLeft(remaining);
    }, 1000);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { phase, secondsLeft, cyclesDone, running: phase !== 'rest', start, stop };
}
