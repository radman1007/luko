/**
 * هم‌رسانیِ داده‌ی دستگاه با حساب — تا سایت و اپِ اندروید برای یک بچه یک چیز نشان بدهند.
 *
 * کیفِ سکه، باغچه، مأموریت‌های امروز، رازها، تنظیمات و ذخیره‌ی داخلِ بازی‌ها
 * سمتِ خودِ اپ حساب می‌شوند و فقط در localStorage بودند؛ هر دستگاه نسخه‌ی
 * خودش را داشت. حالا همان کلیدها (`syncKeys.ts`) با `GET/POST /sync` بینِ
 * دستگاه‌های یک حساب رفت‌وآمد می‌کنند:
 *
 *   ۱. تغییراتِ سرور از آخرین بار گرفته می‌شود؛
 *   ۲. هر کلید سه‌طرفه ادغام می‌شود (`merge.ts`) — پایه همان آخرین مقدارِ
 *      هم‌رسان‌شده است، پس کارِ دو دستگاه روی هم جمع می‌شود نه جای هم؛
 *   ۳. نتیجه در localStorage نوشته و به فروشگاه‌های اپ خبر داده می‌شود
 *      (رویدادِ storage)، و آنچه سرور هنوز ندارد فرستاده می‌شود — فقط روی نسخه‌ای
 *      که دیده‌ایم؛ اگر دستگاهِ دیگری وسطش نوشته بود، دوباره ادغام می‌کنیم.
 *
 * بی‌اینترنت چیزی عوض نمی‌شود: داده‌ها سرِ جایشان‌اند و دفعه‌ی بعد هم‌رسان می‌شوند.
 * مهمان هم‌رسانی ندارد. داده‌ی هر بچه مالِ همان بچه است: با خروج یا ورودِ
 * بچه‌ی دیگر روی همین گوشی، داده‌ی قبلی کنار گذاشته (stash) و پاک می‌شود و
 * هرگز به حسابِ دیگری نمی‌رود.
 */
import { isTransientError, tokenStorage } from '@/lib/api';
import { syncApi } from './api';
import type { SyncChange, SyncItem } from './api';
import { mergeValue } from './merge';
import { strategyFor } from './syncKeys';

const META_KEY = 'luko_sync_meta';
const STASH_PREFIX = 'luko_sync_stash_';
/** ذخیره‌ای بزرگ‌تر از این (بازیِ خاص) هم‌رسان نمی‌شود؛ سقفِ سرور ۲۵۶ کیلوبایت است */
const MAX_VALUE = 200 * 1024;
const MAX_ROUNDS = 3;
const BATCH = 150;
const EVERY_MS = 30_000;
const DEBOUNCE_MS = 1500;

interface Meta {
  owner: string;
  /** از سرور: تغییراتِ بعد از این را بگیر */
  since: string | null;
  /** آخرین مقدارِ هم‌رسان‌شده‌ی هر کلید — پایه‌ی ادغامِ سه‌طرفه */
  base: Record<string, string | null>;
  /** نسخه‌ی سرورِ هر کلید */
  versions: Record<string, number>;
}

interface Stash {
  meta: Meta;
  values: Record<string, string>;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* حافظه پر — دفعه‌ی بعد از اول */
  }
}

/** بچه‌ی واردشده؛ مهمان و والد هم‌رسانی ندارند */
function kidOwner(): string | null {
  if (!tokenStorage.get('kid')) return null;
  return tokenStorage.getUser('kid')?.id ?? null;
}

function syncedLocalKeys(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && strategyFor(key, now)) keys.push(key);
  }
  return keys;
}

const tooBig = (value: string | null) => value !== null && value.length > MAX_VALUE;

let notifying = false;

/** فروشگاه‌های اپ (کیف، باغچه، تنظیمات…) با رویدادِ storage خودشان را تازه می‌کنند */
function notify(changes: Array<{ key: string; oldValue: string | null; newValue: string | null }>): void {
  if (changes.length === 0) return;
  notifying = true;
  try {
    for (const { key, oldValue, newValue } of changes) {
      window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, storageArea: localStorage }));
    }
    window.dispatchEvent(new CustomEvent('luko:account-synced', { detail: changes.map((c) => c.key) }));
  } finally {
    notifying = false;
  }
}

function writeLocal(key: string, value: string | null, changed: Parameters<typeof notify>[0]): void {
  const oldValue = localStorage.getItem(key);
  if (oldValue === value) return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    changed.push({ key, oldValue, newValue: value });
  } catch {
    /* حافظه پر: مقدارِ همین دستگاه می‌ماند و دفعه‌ی بعد دوباره ادغام می‌شود */
  }
}

/**
 * داده‌ی بچه‌ی قبلی کنار گذاشته و پاک می‌شود. اگر همان بچه دوباره روی همین
 * گوشی وارد شود، از همان‌جا ادامه می‌دهد (آنچه هنوز نفرستاده بود گم نمی‌شود).
 */
function stashAndClear(meta: Meta, changed: Parameters<typeof notify>[0]): void {
  const values: Record<string, string> = {};
  for (const key of syncedLocalKeys()) {
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  writeJSON(STASH_PREFIX + meta.owner, { meta, values } satisfies Stash);
  for (const key of Object.keys(values)) writeLocal(key, null, changed);
  localStorage.removeItem(META_KEY);
}

function restoreStash(owner: string, changed: Parameters<typeof notify>[0]): Meta | null {
  const stash = readJSON<Stash>(STASH_PREFIX + owner);
  if (!stash) return null;
  for (const [key, value] of Object.entries(stash.values)) writeLocal(key, value, changed);
  localStorage.removeItem(STASH_PREFIX + owner);
  return stash.meta?.owner === owner ? stash.meta : null;
}

export interface SyncOutcome {
  pulled: number;
  pushed: number;
  /** کلیدهایی که با داده‌ی دستگاهِ دیگر عوض شدند */
  updated: string[];
}

async function syncOnce(): Promise<SyncOutcome | null> {
  const owner = kidOwner();
  if (!owner) return null;

  /**
   * بعد از هر درخواست: اگر نشست در این فاصله بسته یا عوض شد، داده‌ی این بچه
   * کنار گذاشته شده (`setAsideSession`) — دیگر به حافظه و پایه دست نمی‌زنیم،
   * وگرنه پایه‌ای بی‌داده می‌ماند و ورودِ بعدی جای خالی را «حذف» می‌فهمید.
   */
  const lost = () => kidOwner() !== owner;
  const changed: Parameters<typeof notify>[0] = [];
  let meta = readJSON<Meta>(META_KEY);
  if (meta && meta.owner !== owner) {
    stashAndClear(meta, changed);
    meta = null;
  }
  if (!meta) {
    meta = restoreStash(owner, changed) ?? { owner, since: null, base: {}, versions: {} };
  }

  let pulled: { since: string; items: SyncItem[] };
  try {
    pulled = await syncApi.pull(meta.since);
  } catch (error) {
    if (lost()) return null;
    writeJSON(META_KEY, meta);
    notify(changed);
    if (isTransientError(error)) return null;
    throw error;
  }

  // صاحبِ نشست وسطِ درخواست عوض شد (خروج/ورود): این دور بی‌اثر
  if (lost()) return null;

  const now = new Date();
  const serverItems = new Map(pulled.items.map((item) => [item.key, item]));
  const keys = new Set([...serverItems.keys(), ...syncedLocalKeys(now), ...Object.keys(meta.base)]);
  let pending: SyncChange[] = [];
  const pendingValues = new Map<string, string | null>();

  for (const key of keys) {
    const strategy = strategyFor(key, now);
    if (!strategy) {
      // کلیدِ روزانه‌ی کهنه: دیگر دنبالش نمی‌کنیم
      delete meta.base[key];
      delete meta.versions[key];
      continue;
    }
    const hasBase = key in meta.base;
    const base = hasBase ? meta.base[key] : undefined;
    const item = serverItems.get(key);
    // سرور از `since` به بعد این را عوض نکرده → همان پایه (یا اصلاً ندارد)
    const server = item ? item.value : hasBase ? (base as string | null) : null;
    const serverVersion = item ? item.version : (meta.versions[key] ?? 0);
    const local = localStorage.getItem(key);
    if (tooBig(local) || tooBig(server)) continue;

    const merged = mergeValue(strategy, base, local, server);
    writeLocal(key, merged, changed);
    if (merged !== server) {
      pending.push({ key, value: merged, baseVersion: serverVersion });
      pendingValues.set(key, merged);
    } else {
      meta.base[key] = merged;
      meta.versions[key] = serverVersion;
    }
  }

  let pushed = 0;
  for (let round = 0; round < MAX_ROUNDS && pending.length > 0; round++) {
    const next: SyncChange[] = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      let res: Awaited<ReturnType<typeof syncApi.push>>;
      try {
        res = await syncApi.push(batch);
      } catch (error) {
        if (lost()) return null;
        // بی‌اینترنت یا شلوغی: آنچه تا این‌جا شد می‌ماند، بقیه دورِ بعد
        writeJSON(META_KEY, meta);
        notify(changed);
        if (isTransientError(error) || (error as { response?: { status?: number } }).response?.status === 409) {
          return { pulled: pulled.items.length, pushed, updated: changed.map((c) => c.key) };
        }
        throw error;
      }
      if (lost()) return null;
      for (const { key, version } of res.applied) {
        meta.base[key] = pendingValues.get(key) ?? null;
        meta.versions[key] = version;
        pushed++;
      }
      for (const conflict of res.conflicts) {
        // دستگاهِ دیگری همین حالا نوشت: با مقدارِ تازه‌اش دوباره ادغام
        const strategy = strategyFor(conflict.key, now);
        if (!strategy) continue;
        const base = conflict.key in meta.base ? meta.base[conflict.key] : undefined;
        const merged = mergeValue(strategy, base, localStorage.getItem(conflict.key), conflict.value);
        writeLocal(conflict.key, merged, changed);
        if (merged === conflict.value) {
          meta.base[conflict.key] = merged;
          meta.versions[conflict.key] = conflict.version;
        } else {
          next.push({ key: conflict.key, value: merged, baseVersion: conflict.version });
          pendingValues.set(conflict.key, merged);
        }
      }
    }
    pending = next;
  }

  meta.since = pulled.since;
  writeJSON(META_KEY, meta);
  notify(changed);
  return { pulled: pulled.items.length, pushed, updated: changed.map((c) => c.key) };
}

let running: Promise<SyncOutcome | null> | null = null;
let again = false;

/** یک دورِ هم‌رسانی؛ اگر همین حالا یکی در جریان است، بعد از آن یک دورِ دیگر */
export function syncAccount(): Promise<SyncOutcome | null> {
  if (running) {
    again = true;
    return running;
  }
  running = syncOnce()
    .catch(() => null)
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncAccount();
      }
    });
  return running;
}

/**
 * خروجِ بچه: آخرین تغییرات با همان توکنِ نشست فرستاده می‌شود و داده‌ی این
 * بچه از گوشی کنار می‌رود تا بچه‌ی بعدی (یا مهمان) آن را نبیند. خروجی را
 * صدازننده پیش از بستنِ نشست روی سرور صبر می‌کند (ولی نه بیشتر از چند ثانیه).
 */
export async function leaveAccount(): Promise<void> {
  const owner = kidOwner();
  const meta = readJSON<Meta>(META_KEY);
  if (!owner) return;
  const token = tokenStorage.get('kid') ?? undefined;
  const changed: Parameters<typeof notify>[0] = [];
  const current = meta && meta.owner === owner ? meta : { owner, since: null, base: {}, versions: {} };

  // آنچه این دستگاه دارد و سرور ندارد، با همان توکن
  const now = new Date();
  const dirty: SyncChange[] = [];
  for (const key of syncedLocalKeys(now)) {
    const value = localStorage.getItem(key);
    if (key in current.base && current.base[key] === value) continue;
    if (tooBig(value)) continue;
    dirty.push({ key, value, baseVersion: current.versions[key] ?? 0 });
  }
  stashAndClear(current, changed);
  notify(changed);
  if (dirty.length === 0 || !token) return;
  try {
    const res = await syncApi.push(dirty.slice(0, BATCH), token);
    // فرستاده شد؛ کنارگذاشته‌ی این بچه دیگر لازم نیست
    if (res.conflicts.length === 0 && dirty.length <= BATCH) localStorage.removeItem(STASH_PREFIX + owner);
  } catch {
    /* بی‌اینترنت: کنارگذاشته می‌ماند تا همین بچه دوباره وارد شود */
  }
}

/**
 * نشست از سمتِ سرور بسته شد (بچه با گوشیِ دیگری وارد شد) یا خارج شد: داده‌ی
 * این بچه کنار گذاشته می‌شود — نه پاک — تا اگر همین بچه دوباره روی همین گوشی
 * وارد شد، آنچه هنوز نفرستاده بود ادغام و فرستاده شود.
 */
export function setAsideSession(): void {
  const meta = readJSON<Meta>(META_KEY);
  if (!meta || kidOwner() === meta.owner) return;
  const changed: Parameters<typeof notify>[0] = [];
  stashAndClear(meta, changed);
  notify(changed);
}

let started = false;
let timer: number | null = null;

function schedule(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void syncAccount();
  }, DEBOUNCE_MS);
}

/** نوشتنِ خودِ اپ روی کلیدی که هم‌رسان می‌شود → کمی بعد هم‌رسانی */
function watchWrites(): void {
  const proto = Storage.prototype;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;
  proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    setItem.call(this, key, value);
    if (this === localStorage && !notifying && strategyFor(key)) schedule();
  };
  proto.removeItem = function patchedRemoveItem(this: Storage, key: string) {
    removeItem.call(this, key);
    if (this === localStorage && !notifying && strategyFor(key)) schedule();
  };
}

/**
 * هم‌رسانیِ خودکار: حالا، با ورود، با برگشتنِ اینترنت، با رفتن/برگشتن به اپ،
 * با هر نوشتنِ اپ یا بازی‌ها روی کلیدِ هم‌رسان، و هر نیم دقیقه.
 */
export function startAccountSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  watchWrites();
  // نوشتنِ بازی‌ها (داخلِ iframe) و تبِ دیگر با رویدادِ storage می‌رسد
  window.addEventListener('storage', (event) => {
    if (!notifying && event.key && strategyFor(event.key)) schedule();
  });
  window.addEventListener('online', () => void syncAccount());
  window.addEventListener('luko:session-changed', () => void syncAccount());
  window.addEventListener('luko:session-ended', setAsideSession);
  document.addEventListener('visibilitychange', () => void syncAccount());
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncAccount();
  }, EVERY_MS);
  void syncAccount();
}
