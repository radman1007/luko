/**
 * پلِ بینِ بازی‌های داخلِ iframe و بک‌اند.
 *
 * بازی‌ها با postMessage سه نوع پیام می‌فرستند (قرارداد در public/games/README.md):
 * `luko-game-event` هر تعامل، `luko-game-complete` پایانِ موفق، و
 * `luko-game-progress` وقتی بچه وسطِ کار صفحه را می‌بندد.
 *
 * این ماژول آن‌ها را بافر می‌کند و دسته‌ای به `POST /games/events` می‌فرستد؛
 * همین رویدادها هستند که گزارشِ پنل والدین از رویشان ساخته می‌شود. بدونِ این،
 * پنل والدین هیچ‌وقت دادهٔ واقعی نمی‌بیند.
 */
import { apiClient, isTransientError, tokenStorage } from '@/lib/api';
import { isGuestMode } from '@/features/auth/guest';

/** بعد از این تعداد رویداد، بدونِ منتظرماندن ارسال می‌شود */
const BATCH_SIZE = 25;
/** حداکثر فاصله‌ی دو ارسال (میلی‌ثانیه) */
const FLUSH_MS = 5000;
/** سقفِ بافر تا حافظه در بازی‌های طولانی باد نکند */
const MAX_BUFFER = 200;
/**
 * رویدادهایی که بی‌اینترنت نرسیدند تا ارسالِ بعد این‌جا می‌مانند — گزارشِ
 * والدین از همین‌ها ساخته می‌شود و بچه‌ای که آفلاین بازی کرده نباید در آن
 * «بی‌فعالیت» دیده شود.
 */
const PENDING_KEY = 'luko_pending_events';
const MAX_PENDING = 400;

export interface GameEventPayload {
  gameSlug: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

let buffer: GameEventPayload[] = [];
let timer: number | null = null;

interface PendingEvents {
  /** شناسه‌ی بچه؛ رویدادِ یک بچه نباید به حسابِ دیگری برود */
  owner: string;
  events: GameEventPayload[];
}

function eventOwner(): string | null {
  return tokenStorage.get('kid') ? tokenStorage.getUser('kid')?.id ?? null : null;
}

/** رویدادهای مانده‌ی همین بچه را برمی‌دارد (و از حافظه پاک می‌کند) */
function takePending(owner: string | null): GameEventPayload[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    localStorage.removeItem(PENDING_KEY);
    const stored = JSON.parse(raw) as PendingEvents;
    return owner && stored.owner === owner && Array.isArray(stored.events) ? stored.events : [];
  } catch {
    return [];
  }
}

function keepPending(owner: string | null, events: GameEventPayload[]): void {
  if (!owner || events.length === 0) return;
  const offlineAt = new Date().toISOString();
  // زمانِ واقعیِ رویداد را سرور نمی‌داند (created_at زمانِ رسیدن است)؛ این نشان می‌دهد آفلاین بوده
  const marked = events.map((event) =>
    event.payload && 'offlineAt' in event.payload
      ? event
      : { ...event, payload: { ...(event.payload ?? {}), offlineAt } },
  );
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ owner, events: marked.slice(-MAX_PENDING) }));
  } catch {
    /* حافظه پر — همان رفتارِ قبل: این دسته از دست می‌رود */
  }
}

function stopTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/** ارسالِ بافر. `keepalive` برای لحظه‌ی بستنِ صفحه است. */
export async function flushEvents(keepalive = false): Promise<void> {
  stopTimer();
  if (isGuestMode()) {
    buffer = [];
    return;
  }

  const owner = eventOwner();
  const batch = [...takePending(owner), ...buffer];
  buffer = [];
  if (batch.length === 0) return;

  // موقعِ بستنِ صفحه، بی‌اینترنت، فرصتِ «ارسال و اگر نشد نگه‌داشتن» نیست
  if (keepalive && typeof navigator !== 'undefined' && navigator.onLine === false) {
    keepPending(owner, batch);
    return;
  }

  try {
    if (keepalive) {
      // موقعِ بستنِ صفحه درخواستِ معمولی لغو می‌شود. sendBeacon هدرِ Authorization
      // نمی‌گیرد، پس fetch با keepalive که هم هدر می‌دهد هم از unload جان سالم می‌برد.
      // تله‌متری همیشه مالِ بچه است، حتی اگر والد هم روی همین مرورگر لاگین باشد
      const token = tokenStorage.get('kid');
      await fetch(`${apiClient.defaults.baseURL}/games/events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      return;
    }
    await apiClient.post('/games/events', batch);
  } catch (error) {
    // شبکه قطع بود: برای ارسالِ بعد می‌مانند (بازی منتظرشان نمی‌ماند). ردِ
    // صریحِ سرور (داده‌ی نامعتبر) تکرار نمی‌شود، وگرنه صف هیچ‌وقت خالی نمی‌شد.
    if (keepalive || isTransientError(error)) keepPending(owner, batch);
  }
}

/** یک رویداد را به صف اضافه می‌کند */
export function trackEvent(event: GameEventPayload): void {
  if (isGuestMode()) return;

  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);

  if (buffer.length >= BATCH_SIZE) {
    void flushEvents();
    return;
  }
  if (timer === null) {
    timer = window.setTimeout(() => void flushEvents(), FLUSH_MS);
  }
}

/** پاداشِ سمت‌سرورِ یک بازیِ کامل‌شده */
export interface CompleteResult {
  alreadyDone: boolean;
  coins: number;
  dew: number;
  fertilizer: number;
  treasures: number;
  /** بهترین ستاره‌ای که تا حالا روی این مرحله گرفته */
  stars: number;
  /** همین اجرا رکوردِ قبلی را بهتر کرد؟ */
  starsImproved: boolean;
}

/**
 * تکمیلِ بازی روی سرور — منبعِ حقیقتِ سکه و جایزه.
 *
 * `stars` را خودِ بازی در `LUKO.finish({ stars })` می‌دهد و از راهِ
 * خلاصه‌ی پایان به این‌جا می‌رسد. اختیاری است: بازی‌ای که هنوز ستاره
 * حساب نمی‌کند چیزی نمی‌فرستد و تکمیلش مثلِ قبل ثبت می‌شود.
 */
export async function completeGame(slug: string, stars?: number): Promise<CompleteResult | null> {
  if (isGuestMode()) return null;
  const body = typeof stars === 'number' ? { stars } : undefined;
  const { data } = await apiClient.post(`/games/${slug}/complete`, body);
  return data.data as CompleteResult;
}
