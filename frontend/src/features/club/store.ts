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
import { grantDew } from '@/features/garden/store';
import { DAILY_MISSIONS, SPORT_TASKS } from './clubData';

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
    coins: snapshot.coins + task.coinReward,
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

export function buy(itemId: string, cost: number): boolean {
  const snapshot = getSnapshot();
  if (snapshot.owned.includes(itemId) || snapshot.coins < cost) return false;
  const next = {
    ...snapshot,
    coins: snapshot.coins - cost,
    owned: [...snapshot.owned, itemId],
  };
  try {
    localStorage.setItem(COINS_KEY, String(next.coins));
    localStorage.setItem(OWNED_KEY, JSON.stringify(next.owned));
  } catch {
    /* حافظه پر/غیرفعال */
  }
  set(next);
  return true;
}

/** سکه‌ها را با مقدارِ سرور هم‌تراز می‌کند (سرور مرجعِ سکه است) */
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
