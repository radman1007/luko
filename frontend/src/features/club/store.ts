/**
 * وضعیتِ باشگاه در یک استورِ ماژولی.
 *
 * مأموریت‌ها دیگر با دکمه‌ی «انجام دادم» تیک نمی‌خورند؛ خودِ پلتفرم وقتی
 * کار واقعاً انجام شد ثبتشان می‌کند. آن لحظه هرجای اپ می‌تواند باشد —
 * پایانِ بازی، ثبتِ حال، تمرینِ تنفس، آب‌دادنِ باغچه — پس وضعیت باید بیرون
 * از یک هوکِ صفحه‌ای بنشیند تا از همه‌جا قابلِ نوشتن و برای همه واکنشی باشد.
 * (همان الگوی `features/garden/store.ts`.)
 */
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew, grantFertilizer, grantSeeds } from '@/features/garden/store';
import { DAILY_MISSIONS, SHOP_ITEMS, SPORT_TASKS } from './clubData';
import type { ShopReward } from './types';

const COINS_KEY = 'luko_coins';
const DAYS_KEY = 'luko_club_days';
const TOTAL_KEY = 'luko_club_total';
const OWNED_KEY = 'luko_club_owned';

const doneKey = (day: string) => `luko_club_done_${day}`;
const sportDoneKey = (day: string) => `luko_sport_done_${day}`;

export const todayStr = () => new Date().toLocaleDateString('en-CA');

export interface ClubState {
  coins: number;
  /** مأموریت‌های امروز */
  doneToday: string[];
  sportDoneToday: string[];
  /** روزهایی که دستِ‌کم یک مأموریت انجام شده — پایه‌ی استریک */
  days: string[];
  /** کلِ مأموریت‌های انجام‌شده از ابتدا */
  total: number;
  owned: string[];
  /** روزی که این وضعیت برایش خوانده شده؛ با عبور از نیمه‌شب تازه می‌شود */
  day: string;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* داده‌ی خراب → مقدار پیش‌فرض */
  }
  return fallback;
}

function readCoins(): number {
  const raw = localStorage.getItem(COINS_KEY);
  if (raw !== null) return Number(raw) || 0;
  localStorage.setItem(COINS_KEY, '120'); // موجودی اولیه‌ی دمو
  return 120;
}

function load(day = todayStr()): ClubState {
  return {
    coins: readCoins(),
    doneToday: readJSON(doneKey(day), []),
    sportDoneToday: readJSON(sportDoneKey(day), []),
    days: readJSON(DAYS_KEY, []),
    total: Number(localStorage.getItem(TOTAL_KEY)) || 0,
    owned: readJSON(OWNED_KEY, []),
    day,
  };
}

let state: ClubState = load();

/**
 * موجودیِ همین لحظه. بازی‌ها (luko-wallet.js) سکه را مستقیم در localStorage
 * می‌نویسند و خبرش (رویدادِ storage یا پیامِ «luko-coins») کمی بعد می‌رسد؛ هر
 * تغییری از عددِ ذخیره‌شده شروع می‌کند تا خرید یا جایزه‌ی همان لحظه‌ی بازی گم نشود.
 */
function freshCoins(snapshot: ClubState): number {
  try {
    const raw = localStorage.getItem(COINS_KEY);
    const coins = raw === null ? Number.NaN : Number(raw);
    if (Number.isInteger(coins) && coins >= 0) return coins;
  } catch {
    /* localStorage در دسترس نیست */
  }
  return snapshot.coins;
}
const listeners = new Set<() => void>();

/**
 * لحظه‌ی نیمه‌شبِ بعدی. `getSnapshot` را هر رندر صدا می‌زنند و ساختنِ Date و
 * `toLocaleDateString` در آن مسیر گران است؛ یک مقایسه‌ی عددی کافی است.
 */
function nextMidnight(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

let dayEndsAt = nextMidnight();

function set(next: ClubState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ClubState {
  // اپ ممکن است از دیشب باز مانده باشد؛ با عوض‌شدنِ روز، مأموریت‌ها تازه می‌شوند
  if (Date.now() >= dayEndsAt) {
    dayEndsAt = nextMidnight();
    const today = todayStr();
    if (state.day !== today) state = load(today);
  }
  return state;
}

/** ثبتِ یک مأموریت — تکراری بی‌اثر است، پس صدازدنِ چندباره اشکالی ندارد */
function complete(kind: 'daily' | 'sport', taskId: string): boolean {
  const snapshot = getSnapshot();
  const list = kind === 'daily' ? DAILY_MISSIONS : SPORT_TASKS;
  const done = kind === 'daily' ? snapshot.doneToday : snapshot.sportDoneToday;
  if (done.includes(taskId)) return false;

  const task = list.find((m) => m.id === taskId);
  if (!task) return false;

  const day = snapshot.day;
  const nextDone = [...done, taskId];
  const next: ClubState = {
    ...snapshot,
    coins: freshCoins(snapshot) + task.coinReward,
    total: snapshot.total + 1,
    days: snapshot.days.includes(day) ? snapshot.days : [...snapshot.days, day],
    doneToday: kind === 'daily' ? nextDone : snapshot.doneToday,
    sportDoneToday: kind === 'sport' ? nextDone : snapshot.sportDoneToday,
  };

  try {
    localStorage.setItem(kind === 'daily' ? doneKey(day) : sportDoneKey(day), JSON.stringify(nextDone));
    localStorage.setItem(COINS_KEY, String(next.coins));
    localStorage.setItem(TOTAL_KEY, String(next.total));
    localStorage.setItem(DAYS_KEY, JSON.stringify(next.days));
  } catch {
    /* حافظه پر/غیرفعال — وضعیتِ درون‌حافظه‌ای می‌ماند */
  }
  set(next);
  grantDew(DEW_REWARD.mission, 'mission');
  return true;
}

/**
 * ثبتِ خودکارِ یک مأموریتِ روزانه. از همان جایی صدا زده می‌شود که کار
 * واقعاً انجام شده (پایانِ بازی، ثبتِ حال، ...). خروجی `true` یعنی همین
 * حالا ثبت شد — برای نشان‌دادنِ پیامِ «سکه گرفتی».
 */
export function completeMission(missionId: string): boolean {
  return complete('daily', missionId);
}

/** ثبتِ یک تمرینِ ورزشی — فقط بعد از تمام‌شدنِ واقعیِ تمرینِ هدایت‌شده */
export function completeSportTask(taskId: string): boolean {
  return complete('sport', taskId);
}

/** بستهٔ تصادفیِ صندوقِ شانس — همیشه دستِ بچه پر برمی‌گردد */
function mysteryReward(): ShopReward {
  const pick = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
  return { dew: pick(15, 40), fertilizer: pick(1, 3), seeds: pick(0, 2) };
}

function applyReward(reward: ShopReward) {
  if (reward.dew) grantDew(reward.dew, 'mission');
  if (reward.fertilizer) grantFertilizer(reward.fertilizer);
  if (reward.seeds) grantSeeds(reward.seeds);
}

export interface BuyResult {
  ok: boolean;
  /** چرا نشد — برای پیامِ درست به بچه */
  reason?: 'poor' | 'owned' | 'unknown';
  /** چه چیزی گرفت (برای بسته‌ها) */
  reward?: ShopReward;
}

/**
 * خریدِ یک کالا.
 *
 * برخلافِ قبل، خرید فقط سکه کم نمی‌کند: بسته‌ها منبعشان را همان لحظه به
 * باغچه می‌ریزند و نشان‌ها روی پروفایل می‌نشینند. نشان یک‌بار خریدنی است،
 * بسته‌ها بارها.
 */
export function buy(itemId: string, cost: number): BuyResult {
  const snapshot = getSnapshot();
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.kind === 'badge' && snapshot.owned.includes(itemId)) {
    return { ok: false, reason: 'owned' };
  }
  const coins = freshCoins(snapshot);
  if (coins < cost) return { ok: false, reason: 'poor' };

  const owned = snapshot.owned.includes(itemId) ? snapshot.owned : [...snapshot.owned, itemId];
  const next = { ...snapshot, coins: coins - cost, owned };
  try {
    localStorage.setItem(COINS_KEY, String(next.coins));
    localStorage.setItem(OWNED_KEY, JSON.stringify(next.owned));
  } catch {
    /* حافظه پر/غیرفعال */
  }
  set(next);

  const reward = item.random ? mysteryReward() : item.reward;
  if (reward) applyReward(reward);
  return { ok: true, reward };
}

/**
 * سکه‌ها را روی یک عددِ مطلق می‌گذارد — عددی که سرور یا کیفِ مشترکِ بازی‌ها
 * (luko-wallet.js، بعد از خرید یا جایزه‌ی داخلِ بازی) گزارش کرده است.
 */
export function syncCoins(serverCoins: number) {
  const snapshot = getSnapshot();
  if (snapshot.coins === serverCoins) return;
  try {
    localStorage.setItem(COINS_KEY, String(serverCoins));
  } catch {
    /* حافظه پر/غیرفعال */
  }
  set({ ...snapshot, coins: serverCoins });
}

/** جایزه‌ی سکه (مثلاً پایانِ یک مرحله) — روی همان کیفی که صفحه‌ی اصلی و بازی‌ها نشان می‌دهند */
export function grantCoins(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const snapshot = getSnapshot();
  const coins = freshCoins(snapshot) + Math.round(amount);
  try {
    localStorage.setItem(COINS_KEY, String(coins));
  } catch {
    /* حافظه پر/غیرفعال */
  }
  set({ ...snapshot, coins });
}

/**
 * بازی‌ها داخلِ iframe و هم‌مبدأ با اپ‌اند و کیفِ مشترک (luko-wallet.js) سکه‌ی
 * اصلی را مستقیم در localStorage می‌نویسند؛ هم‌رسانیِ حساب هم داده‌ی دستگاهِ
 * دیگر را همین‌طور می‌نویسد. مرورگر به بقیه‌ی پنجره‌های همان مبدأ رویدادِ
 * storage می‌دهد (هم‌رسانی خودش هم همین رویداد را می‌فرستد)؛ این‌جا وضعیت از
 * نو خوانده می‌شود تا صفحه‌ی اصلی و باشگاه همان را نشان دهند.
 */
/** کلیدهای باشگاه؛ هم‌رسانیِ حساب (`features/sync`) هم همین‌ها را می‌نویسد */
const CLUB_KEY = /^luko_(coins|club_days|club_total|club_owned|club_done_.+|sport_done_.+)$/;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // key=null یعنی کلِ حافظه پاک شد؛ وگرنه فقط کلیدهای باشگاه
    if (event.key !== null && !CLUB_KEY.test(event.key)) return;
    set(load(getSnapshot().day));
  });
}
