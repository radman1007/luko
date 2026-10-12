/**
 * پلِ بینِ بازی‌های داخلِ iframe و بک‌اند.
 *
 * بازی‌ها با postMessage سه نوع پیام می‌فرستند (قرارداد: docs/event-tracking-guide.md):
 * `luko-game-event` هر تعامل، `luko-game-complete` پایانِ موفق، و
 * `luko-game-progress` وقتی بچه وسطِ کار صفحه را می‌بندد.
 *
 * `toApiEvents` هر پیام را به شکلِ API درمی‌آورد (نسخه‌ی ۳، یا نسخه‌ی ۲ از SDKِ کش‌شده)،
 * این ماژول بافرشان می‌کند و دسته‌ای به `POST /games/events` می‌فرستد؛ گزارشِ پنلِ والدین
 * از همین رویدادها ساخته می‌شود. شناسه‌ی بازی را صفحه‌ی بازی می‌گذارد، نه خودِ بازی.
 */
import { apiClient, isTransientError, tokenStorage } from '@/lib/api';
import { isGuestMode } from '@/features/auth/guest';

/** بعد از این تعداد رویداد، بدونِ منتظرماندن ارسال می‌شود */
const BATCH_SIZE = 25;
/** سقفِ هر درخواست (سرور تا ۲۰۰ می‌پذیرد؛ صفِ آفلاین می‌تواند چند صد تا باشد) */
const REQUEST_ITEMS = 100;
/** fetchِ keepalive در کلِ صفحه حداکثر ۶۴KB بدنه دارد؛ بقیه در صف می‌ماند */
const KEEPALIVE_BYTES = 56_000;
/** درخواستِ معمولی هم زیرِ سقفِ بدنه‌ی جنگو (۲.۵MB) بماند، حتی با خلاصه‌های بزرگ */
const REQUEST_BYTES = 1_000_000;
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

/** یک رویداد به شکلِ `POST /games/events` (کلیدها را سرور snake_case می‌کند؛ payload دست‌نخورده) */
export interface GameEventPayload {
  gameSlug: string;
  eventType: string;
  schemaVersion?: number;
  eventId?: string;
  sessionId?: string;
  /** میلی‌ثانیه از ۱۹۷۰، زمانِ رویداد در دستگاهِ بچه */
  occurredAt?: number;
  conceptTag?: string;
  level?: number | null;
  isCorrect?: boolean;
  timeTakenMs?: number;
  attemptNumber?: number;
  errorType?: string;
  hintUsed?: boolean;
  durationMs?: number;
  payload?: Record<string, unknown>;
}

type Dict = Record<string, unknown>;

const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null && !Array.isArray(value);
const numberOr = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const textOr = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);
const boolOr = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

/** رویدادِ نسخه‌ی ۳ (SDKِ v3): ستون‌های استاندارد از `data` بیرون می‌آیند، بقیه payload می‌ماند */
function fromV3(slug: string, event: Dict): GameEventPayload | null {
  const type = textOr(event.event_type);
  if (!type) return null;
  const data = isDict(event.data) ? { ...event.data } : {};
  const take = (key: string) => {
    const value = data[key];
    delete data[key];
    return value;
  };
  return {
    gameSlug: slug,
    eventType: type,
    schemaVersion: 3,
    eventId: textOr(event.event_id),
    sessionId: textOr(event.session_id),
    occurredAt: numberOr(event.timestamp),
    conceptTag: textOr(event.concept_tag),
    level: numberOr(event.level) ?? null,
    isCorrect: boolOr(take('is_correct')),
    timeTakenMs: numberOr(take('time_taken_ms')),
    attemptNumber: numberOr(take('attempt_number')),
    errorType: textOr(take('error_type')),
    hintUsed: boolOr(take('hint_used')),
    durationMs: numberOr(take('duration_ms')),
    payload: data,
  };
}

/**
 * پیامِ بازی → رویدادهای API (صفر یا یکی). `slug` شناسه‌ی بازی از صفحه‌ی بازی است.
 *
 * - `luko-game-event`: نسخه‌ی ۳، یا نسخه‌ی ۲ (`{type, at, …}`) که سرور خودش می‌فهمد
 * - `luko-game-complete` / `luko-game-progress`: خلاصه‌ی جلسه → `game_complete` / `game_end`
 *   با زمانِ فعال (بی‌مکث) در `durationMs`
 */
export function toApiEvents(slug: string, message: unknown): GameEventPayload[] {
  if (!isDict(message) || typeof message.type !== 'string') return [];
  const sessionId = textOr(message.sessionId);

  if (message.type === 'luko-game-event' && isDict(message.event)) {
    const event = message.event;
    if (event.schema_version === 3) {
      const item = fromV3(slug, event);
      return item ? [item] : [];
    }
    const { type, ...rest } = event;
    return typeof type === 'string' ? [{ gameSlug: slug, eventType: type, sessionId, payload: rest }] : [];
  }

  if (message.type === 'luko-game-complete' || message.type === 'luko-game-progress') {
    const summary = isDict(message.summary) ? message.summary : {};
    return [{
      gameSlug: slug,
      eventType: message.type === 'luko-game-complete' ? 'game_complete' : 'game_end',
      schemaVersion: 3,
      sessionId: textOr(summary.sessionId) ?? sessionId,
      occurredAt: Date.now(),
      durationMs: numberOr(summary.activeMs) ?? numberOr(summary.durationMs),
      payload: summary,
    }];
  }
  return [];
}

/** دسته‌های ارسال: هر کدام حداکثر REQUEST_ITEMS رویداد و (در keepalive) حداکثر KEEPALIVE_BYTES */
export function chunkEvents(events: GameEventPayload[], maxBytes = Infinity): GameEventPayload[][] {
  const chunks: GameEventPayload[][] = [];
  let current: GameEventPayload[] = [];
  let bytes = 2;
  for (const event of events) {
    const size = JSON.stringify(event).length + 1;
    if (current.length && (current.length >= REQUEST_ITEMS || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 2;
    }
    current.push(event);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
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

  if (keepalive) {
    // موقعِ بستنِ صفحه درخواستِ معمولی لغو می‌شود. sendBeacon هدرِ Authorization
    // نمی‌گیرد، پس fetch با keepalive که هم هدر می‌دهد هم از unload جان سالم می‌برد.
    // مرورگر بدنه‌ی keepalive را به ۶۴KB محدود می‌کند: اولین دسته‌ای که جا می‌شود می‌رود،
    // بقیه برای بازکردنِ بعدی می‌مانند.
    const [first, ...rest] = chunkEvents(batch, KEEPALIVE_BYTES);
    keepPending(owner, rest.flat());
    // تله‌متری همیشه مالِ بچه است، حتی اگر والد هم روی همین مرورگر لاگین باشد
    const token = tokenStorage.get('kid');
    try {
      await fetch(`${apiClient.defaults.baseURL}/games/events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(first),
      });
    } catch {
      keepPending(owner, [...first, ...rest.flat()]);
    }
    return;
  }

  const chunks = chunkEvents(batch, REQUEST_BYTES);
  for (let i = 0; i < chunks.length; i += 1) {
    try {
      await apiClient.post('/games/events', chunks[i]);
    } catch (error) {
      // شبکه قطع بود: این دسته و بقیه برای ارسالِ بعد می‌مانند (بازی منتظرشان نمی‌ماند).
      // ردِ صریحِ سرور (داده‌ی نامعتبر) تکرار نمی‌شود، وگرنه صف هیچ‌وقت خالی نمی‌شد.
      // تکرارِ رویدادی که شاید رسیده بوده بی‌خطر است: سرور با eventId یک‌بار ثبت می‌کند.
      if (isTransientError(error)) keepPending(owner, chunks.slice(i).flat());
      return;
    }
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
