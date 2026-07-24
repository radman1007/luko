/**
 * استورِ مستقل باغچه (بیرون از React) تا هم صفحه‌ی باغچه و هم بقیه‌ی اپ
 * (بازی‌ها، باشگاه، شمارنده‌ی زمان) بتوانند شبنم/کود بدهند و همه هم‌زمان به‌روز شوند.
 * فعلاً روی localStorage؛ TODO: sync با بک‌اند (gardenService).
 */
import {
  CARE_PER_STAGE,
  GARDEN_KEY,
  GARDEN_SHOP,
  MAX_PLOT_LEVEL,
  MAX_STAGE,
  FERT_CARE,
  PLANT_KINDS,
  SLOTS_BASE,
  SLOTS_PER_LEVEL,
  WATER,
  WATER_CARE,
} from './gardenData';
import type { DewSource, GardenState, GrowthStage, Plant, PlantKind } from './types';

const DEW_LOG_MAX = 20;

function initial(): GardenState {
  const now = Date.now();
  return {
    dew: 20,
    dewLog: [],
    fertilizer: 1,
    seeds: 2,
    plants: [{ id: newId(), kind: 'sunflower', plantedAt: now, care: 2 }],
    plotLevel: 1,
    decor: [],
    waterCharges: WATER.baseMax,
    lastRefillAt: now,
    seasonStartAt: now,
    lastWateredAt: null,
  };
}

function load(): GardenState {
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GardenState>;
      // ادغام با پیش‌فرض‌ها تا فیلدهای جدید در نسخه‌های بعدی خراب نشوند
      return { ...initial(), ...parsed, plants: parsed.plants ?? [] };
    }
  } catch {
    /* داده‌ی خراب → از نو */
  }
  return initial();
}

let state: GardenState = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(GARDEN_KEY, JSON.stringify(state));
  } catch {
    /* حافظه پر/غیرفعال — بی‌صدا رد شو */
  }
}

function set(next: GardenState) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): GardenState {
  return state;
}

// ---------- کمک‌کننده‌های خالص (بدون تغییر state) ----------

function newId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function slotsOf(plotLevel: number): number {
  return SLOTS_BASE + (plotLevel - 1) * SLOTS_PER_LEVEL;
}

export function maxWaterOf(plotLevel: number): number {
  return WATER.baseMax + (plotLevel - 1) * WATER.perPlotLevel;
}

export function stageOf(plant: Plant): GrowthStage {
  return Math.min(MAX_STAGE, Math.floor(plant.care / CARE_PER_STAGE)) as GrowthStage;
}

/** شارژ آبِ فعلی را با احتساب پر شدنِ زمانی حساب می‌کند (بدون تغییر state) */
export function settleWater(s: GardenState, now = Date.now()) {
  const max = maxWaterOf(s.plotLevel);
  if (s.waterCharges >= max) return { waterCharges: max, lastRefillAt: now };
  const gained = Math.floor((now - s.lastRefillAt) / WATER.refillMs);
  if (gained <= 0) return { waterCharges: s.waterCharges, lastRefillAt: s.lastRefillAt };
  const waterCharges = Math.min(max, s.waterCharges + gained);
  const lastRefillAt = waterCharges >= max ? now : s.lastRefillAt + gained * WATER.refillMs;
  return { waterCharges, lastRefillAt };
}

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: 'full' | 'noseed' | 'nowater' | 'nofert' | 'noplant' | 'nodew' | 'maxed' | 'owned' | 'unknown' };

// ---------- اکشن‌ها ----------

function pickKind(index: number): PlantKind {
  // چرخشی + کمی تصادف تا باغچه متنوع شود
  const offset = Math.floor(Math.random() * PLANT_KINDS.length);
  return PLANT_KINDS[(index + offset) % PLANT_KINDS.length];
}

export function plantSeed(): ActionResult {
  if (state.plants.length >= slotsOf(state.plotLevel)) return { ok: false, reason: 'full' };
  if (state.seeds <= 0) return { ok: false, reason: 'noseed' };
  const plant: Plant = {
    id: newId(),
    kind: pickKind(state.plants.length),
    plantedAt: Date.now(),
    care: 0,
  };
  set({ ...state, seeds: state.seeds - 1, plants: [...state.plants, plant] });
  return { ok: true };
}

export function waterAll(): ActionResult {
  if (state.plants.length === 0) return { ok: false, reason: 'noplant' };
  const settled = settleWater(state);
  if (settled.waterCharges < 1) return { ok: false, reason: 'nowater' };
  set({
    ...state,
    waterCharges: settled.waterCharges - 1,
    lastRefillAt: settled.lastRefillAt,
    lastWateredAt: Date.now(),
    plants: state.plants.map((p) => ({ ...p, care: p.care + WATER_CARE })),
  });
  return { ok: true };
}

export function fertilizeAll(): ActionResult {
  if (state.plants.length === 0) return { ok: false, reason: 'noplant' };
  if (state.fertilizer <= 0) return { ok: false, reason: 'nofert' };
  set({
    ...state,
    fertilizer: state.fertilizer - 1,
    plants: state.plants.map((p) => ({ ...p, care: p.care + FERT_CARE })),
  });
  return { ok: true };
}

export function buy(itemId: string): ActionResult {
  const item = GARDEN_SHOP.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (state.dew < item.cost) return { ok: false, reason: 'nodew' };

  const next: GardenState = { ...state, dew: state.dew - item.cost };
  switch (item.kind) {
    case 'seed':
      next.seeds = state.seeds + 1;
      break;
    case 'fertilizer':
      next.fertilizer = state.fertilizer + 2;
      break;
    case 'plot': {
      if (state.plotLevel >= MAX_PLOT_LEVEL) return { ok: false, reason: 'maxed' };
      next.plotLevel = state.plotLevel + 1;
      next.waterCharges = maxWaterOf(next.plotLevel); // پاداش: آب‌پاش پر می‌شود
      next.lastRefillAt = Date.now();
      break;
    }
    case 'decor': {
      const id = item.payload ?? item.id;
      if (state.decor.includes(id)) return { ok: false, reason: 'owned' };
      next.decor = [...state.decor, id];
      break;
    }
  }
  set(next);
  return { ok: true };
}

// ---------- توابع grant برای بقیه‌ی اپ ----------

/** شبنم می‌دهد و در دفترچه ثبت می‌کند — بازی‌ها، مأموریت‌ها، مدال‌ها و... از این استفاده می‌کنند */
export function grantDew(amount: number, source: DewSource) {
  if (amount <= 0) return;
  const entry = { amount, source, at: Date.now() };
  set({ ...state, dew: state.dew + amount, dewLog: [entry, ...state.dewLog].slice(0, DEW_LOG_MAX) });
}

/** کود می‌دهد — بعضی بازی‌ها موقع تکمیل کود جایزه می‌دهند */
export function grantFertilizer(amount: number) {
  if (amount <= 0) return;
  set({ ...state, fertilizer: state.fertilizer + amount });
}

export function grantSeeds(amount: number) {
  if (amount <= 0) return;
  set({ ...state, seeds: state.seeds + amount });
}
