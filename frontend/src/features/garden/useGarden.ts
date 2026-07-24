import { useEffect, useState, useSyncExternalStore } from 'react';
import { WATER, seasonFrom } from './gardenData';
import {
  buy,
  fertilizeAll,
  getSnapshot,
  maxWaterOf,
  plantSeed,
  settleWater,
  slotsOf,
  stageOf,
  subscribe,
  waterAll,
} from './store';

/**
 * وضعیت باغچه برای UI: مقادیر مشتق‌شده + اکشن‌های آماده.
 * شارژ آب چون زمان‌محور است هر ۱۵ ثانیه دوباره حساب می‌شود تا شمارش معکوس زنده بماند.
 */
export function useGarden() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // تیک سبک فقط برای زنده‌نگه‌داشتنِ محاسبه‌ی پر شدن آب‌پاش
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const settled = settleWater(state, now);
  const maxWater = maxWaterOf(state.plotLevel);
  const slots = slotsOf(state.plotLevel);
  const season = seasonFrom(state.seasonStartAt, now);

  const nextRefillMs =
    settled.waterCharges >= maxWater
      ? 0
      : Math.max(0, WATER.refillMs - (now - settled.lastRefillAt));

  const plants = state.plants.map((p) => ({ ...p, stage: stageOf(p) }));

  return {
    dew: state.dew,
    dewLog: state.dewLog,
    fertilizer: state.fertilizer,
    seeds: state.seeds,
    plants,
    plotLevel: state.plotLevel,
    decor: state.decor,
    slots,
    currentWater: settled.waterCharges,
    maxWater,
    nextRefillMs,
    season,

    canPlant: plants.length < slots && state.seeds > 0,
    canWater: plants.length > 0 && settled.waterCharges >= 1,
    canFertilize: plants.length > 0 && state.fertilizer > 0,

    plantSeed,
    waterAll,
    fertilizeAll,
    buy,
  };
}
