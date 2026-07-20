import { useCallback, useState } from 'react';
import type { GardenState } from './types';

const GARDEN_KEY = 'luko_garden';
const WATER_COOLDOWN_MS = 60 * 60 * 1000; // هر ساعت یک بار
const WATERS_PER_STAGE = 3;
export const MAX_STAGE = 3;

function load(): GardenState {
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    if (raw) return JSON.parse(raw) as GardenState;
  } catch {
    /* داده‌ی خراب → از نو */
  }
  return { waterCount: 0, lastWateredAt: null };
}

/** باغچه‌ی مجازی: با هر آبیاری گیاه رشد می‌کند (TODO: sync با بک‌اند) */
export function useGarden() {
  const [state, setState] = useState<GardenState>(load);

  const stage = Math.min(MAX_STAGE, Math.floor(state.waterCount / WATERS_PER_STAGE)) as
    | 0
    | 1
    | 2
    | 3;

  const canWater =
    state.lastWateredAt === null || Date.now() - state.lastWateredAt >= WATER_COOLDOWN_MS;

  const water = useCallback(() => {
    setState((prev) => {
      const next: GardenState = {
        waterCount: prev.waterCount + 1,
        lastWateredAt: Date.now(),
      };
      localStorage.setItem(GARDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { stage, waterCount: state.waterCount, canWater, water };
}
