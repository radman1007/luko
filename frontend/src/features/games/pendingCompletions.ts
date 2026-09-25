/**
 * صفِ تکمیل‌های بی‌اینترنت.
 *
 * بچه‌ای که آفلاین (مثلاً در اپِ اندروید بی‌اینترنت) مرحله‌ای را می‌برد نباید
 * پیشرفتش گم شود. تکمیل این‌جا در localStorage می‌ماند، نقشه همان لحظه آن را
 * «رفته» می‌بیند و مرحله‌ی بعد باز می‌شود، و با برگشتنِ اینترنت به همان ترتیبِ
 * بازی‌شدن به `POST /games/<slug>/complete` می‌رود — سرور قفلِ پشتِ‌سرهم را
 * می‌سنجد، پس ترتیب مهم است.
 *
 * هر ردیف مالِ یک بچه است: اگر بچه‌ی دیگری روی همین گوشی وارد شود، صفِ قبلی
 * به حسابِ او نمی‌رود.
 */
import type { AxiosError } from 'axios';
import { isTransientError, tokenStorage } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { grantCoins } from '@/features/club/store';
import { completeGame, flushEvents } from './telemetry';
import type { CompleteResult } from './telemetry';

const KEY = 'luko_pending_completions';
/** سقفِ صف — بیشتر از کلِ مرحله‌های یک کلاس */
const MAX_ITEMS = 300;
const SYNC_EVERY_MS = 60_000;

export interface PendingCompletion {
  slug: string;
  /** بهترین ستاره‌ی اجراهای آفلاینِ این مرحله */
  stars?: number;
  /** شناسه‌ی بچه */
  owner: string;
  at: number;
  /**
   * سکه‌ای که همان لحظه به کیف داده شد. `null` یعنی هنوز تصمیمی گرفته نشده؛
   * آن‌وقت سکه‌ی سرور (اگر تازه باشد) هنگامِ ارسال داده می‌شود.
   */
  granted: number | null;
}

function read(): PendingCompletion[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PendingCompletion[]) : [];
    return Array.isArray(list) ? list.filter((item) => item && typeof item.slug === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: PendingCompletion[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
  } catch {
    /* حافظه پر — دست‌کم تکمیلِ محلی (luko_completed_games) سرِ جایش است */
  }
}

/** بچه‌ی واردشده؛ مهمان و بی‌حساب صف ندارند */
function currentOwner(): string | null {
  if (!tokenStorage.get('kid')) return null;
  return tokenStorage.getUser('kid')?.id ?? null;
}

const same = (a: PendingCompletion, owner: string, slug: string) => a.owner === owner && a.slug === slug;

/** ثبتِ یک تکمیل در صف. تکرارِ همان مرحله ردیفِ تازه نمی‌سازد، فقط بهترین ستاره را نگه می‌دارد. */
export function queueCompletion(slug: string, stars?: number): boolean {
  const owner = currentOwner();
  if (!owner) return false;
  const list = read();
  const existing = list.find((item) => same(item, owner, slug));
  if (existing) {
    if (typeof stars === 'number') existing.stars = Math.max(existing.stars ?? 0, stars);
  } else {
    list.push({ slug, stars, owner, at: Date.now(), granted: null });
  }
  write(list);
  return true;
}

/** مرحله‌هایی که بچه‌ی فعلی برده و هنوز به سرور نرسیده‌اند */
export function pendingSlugs(): Set<string> {
  const owner = currentOwner();
  if (!owner) return new Set();
  return new Set(read().filter((item) => item.owner === owner).map((item) => item.slug));
}

export function isPendingCompletion(slug: string): boolean {
  return pendingSlugs().has(slug);
}

/** سکه‌ی این مرحله همین حالا (آفلاین) به کیف رفت؛ هنگامِ ارسال دوباره داده نشود */
export function markCompletionGranted(slug: string, coins: number): void {
  const owner = currentOwner();
  if (!owner) return;
  const list = read();
  const item = list.find((entry) => same(entry, owner, slug));
  if (!item) return;
  item.granted = coins;
  write(list);
}

function remove(owner: string, slug: string): void {
  write(read().filter((item) => !same(item, owner, slug)));
}

interface Progress {
  completed: string[];
  stars: Record<string, number>;
}

/**
 * پیشرفتِ سرور را همین‌جا به‌روز می‌کند. invalidate به‌تنهایی کافی نبود: نقشه
 * آن لحظه روی صفحه نیست، پس دوباره گرفته نمی‌شد و نسخه‌ی ذخیره‌شده‌ی کهنه
 * برای بازشدنِ بعدیِ بی‌اینترنت می‌ماند — مرحله‌ای که همین حالا ثبت شد «نرفته»
 * و مرحله‌ی بعدش قفل دیده می‌شد.
 */
function recordDone(slug: string, stars: number): void {
  queryClient.setQueryData<Progress>(['games', 'completed'], (old) =>
    old
      ? {
          completed: old.completed.includes(slug) ? old.completed : [...old.completed, slug],
          stars: { ...old.stars, [slug]: Math.max(old.stars[slug] ?? 0, stars) },
        }
      : old,
  );
}

let inflight: Promise<Map<string, CompleteResult>> | null = null;

/**
 * ارسالِ صف به ترتیب. خروجی: جوابِ سرور برای هر مرحله‌ای که همین دور ثبت شد.
 *
 * `claimed` مرحله‌ای است که صدازننده خودش جایزه‌اش را می‌دهد (صفحه‌ی بازی،
 * همان لحظه‌ی بُرد)؛ سکه‌ی بقیه همین‌جا داده می‌شود.
 */
export function flushCompletions(claimed?: string): Promise<Map<string, CompleteResult>> {
  if (!inflight) {
    inflight = send(claimed).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function send(claimed?: string): Promise<Map<string, CompleteResult>> {
  const results = new Map<string, CompleteResult>();
  const owner = currentOwner();
  if (!owner) return results;

  let changed = false;
  for (const item of read().filter((entry) => entry.owner === owner)) {
    try {
      const result = await completeGame(item.slug, item.stars);
      if (!result) break; // مهمان شده — صف منتظرِ همان بچه می‌ماند
      results.set(item.slug, result);
      const fresh = read().find((entry) => same(entry, owner, item.slug));
      const granted = fresh ? fresh.granted : item.granted;
      if (item.slug !== claimed && !granted && !result.alreadyDone && result.coins > 0) {
        grantCoins(result.coins);
      }
      remove(owner, item.slug);
      recordDone(item.slug, result.stars);
      changed = true;
    } catch (error) {
      // اینترنت هنوز نیست یا نشست باید تمدید شود: بقیه برای دورِ بعد
      if (isTransientError(error)) break;
      if ((error as AxiosError).response?.status === 401) break;
      // سرور صریحاً رد کرد (مرحله‌ی حذف‌شده یا قفل): تکرارش فایده ندارد
      remove(owner, item.slug);
      changed = true;
    }
  }
  if (changed) {
    // امتیاز و گنج هم با ثبتِ مرحله روی سرور بالا رفته‌اند
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: ['treasures'] });
    await queryClient.invalidateQueries({ queryKey: ['games', 'completed'] });
  }
  return results;
}

let started = false;

/** همگام‌سازیِ خودکار: حالا، با برگشتنِ اینترنت، با برگشتن به اپ، و هر دقیقه */
export function startOfflineSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const sync = () => {
    if (!currentOwner()) return;
    void flushEvents();
    if (pendingSlugs().size > 0) void flushCompletions();
  };
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });
  window.setInterval(sync, SYNC_EVERY_MS);
  sync();
}
