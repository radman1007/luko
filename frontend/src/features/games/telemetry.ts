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
import { apiClient, tokenStorage } from '@/lib/api';
import { isGuestMode } from '@/features/auth/guest';

/** بعد از این تعداد رویداد، بدونِ منتظرماندن ارسال می‌شود */
const BATCH_SIZE = 25;
/** حداکثر فاصله‌ی دو ارسال (میلی‌ثانیه) */
const FLUSH_MS = 5000;
/** سقفِ بافر تا حافظه در بازی‌های طولانی باد نکند */
const MAX_BUFFER = 200;

export interface GameEventPayload {
  gameSlug: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

let buffer: GameEventPayload[] = [];
let timer: number | null = null;

function stopTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/** ارسالِ بافر. `keepalive` برای لحظه‌ی بستنِ صفحه است. */
export async function flushEvents(keepalive = false): Promise<void> {
  stopTimer();
  if (buffer.length === 0 || isGuestMode()) {
    buffer = [];
    return;
  }

  const batch = buffer;
  buffer = [];

  try {
    if (keepalive) {
      // موقعِ بستنِ صفحه درخواستِ معمولی لغو می‌شود. sendBeacon هدرِ Authorization
      // نمی‌گیرد، پس fetch با keepalive که هم هدر می‌دهد هم از unload جان سالم می‌برد.
      const token = tokenStorage.get();
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
  } catch {
    // شبکه قطع بود: رویدادها را دور می‌ریزیم تا بازی گیر نکند.
    // (تله‌متری داده‌ی درجه‌دوم است؛ سکه و تکمیل مسیرِ جداگانه و مطمئن دارند.)
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
}

/** تکمیلِ بازی روی سرور — منبعِ حقیقتِ سکه و جایزه */
export async function completeGame(slug: string): Promise<CompleteResult | null> {
  if (isGuestMode()) return null;
  const { data } = await apiClient.post(`/games/${slug}/complete`);
  return data.data as CompleteResult;
}
