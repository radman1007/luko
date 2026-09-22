import { dehydrate, hydrate } from '@tanstack/react-query';
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * نگه‌داشتنِ داده‌های سرور برای بازشدنِ بی‌اینترنت.
 *
 * TanStack Query همه‌چیز را فقط در حافظه دارد؛ اپی که بی‌اینترنت باز می‌شد
 * (مخصوصاً اپِ اندروید) مسیرِ بازی‌ها و پیشرفت را نمی‌دید و بچه جلوی «مسیر
 * باز نشد» می‌ماند. پس آخرین پاسخِ موفقِ چند پرس‌وجوی بچه در localStorage
 * می‌ماند و بارِ بعد پیش از هر درخواستی سرِ جایش می‌نشیند؛ با اینترنت،
 * همان‌ها طبقِ `staleTime` خودشان تازه می‌شوند.
 *
 * فقط فهرستِ زیر: پنلِ والدین (رمزِ بچه، گزارش‌ها) و تصویرها عمداً بیرون‌اند.
 */
const STORAGE_KEY = 'luko_query_cache';
/** با عوض‌شدنِ شکلِ داده‌ها بالا برود تا نسخه‌ی کهنه خوانده نشود */
const VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 800;

/** `shared` مالِ همه است (مسیرِ کلاس)؛ `personal` فقط مالِ همان بچه */
type Scope = 'shared' | 'personal';

export function persistScope(key: QueryKey): Scope | null {
  const [a, b] = key as unknown[];
  if (a === 'games' && (b === 'path' || b === 'grades')) return 'shared';
  if (a === 'games' && (b === 'completed' || b === 'memories')) return 'personal';
  if (a === 'my-assignment') return 'personal';
  return null;
}

/** پرس‌وجوهای شخصی — با عوض‌شدنِ بچه‌ی واردشده باید دور ریخته شوند */
export function isPersonalQuery(query: Query): boolean {
  return persistScope(query.queryKey) === 'personal';
}

interface Stored {
  version: number;
  savedAt: number;
  /** شناسه‌ی بچه‌ای که داده‌های شخصی مالِ اوست */
  owner: string | null;
  state: ReturnType<typeof dehydrate>;
}

/** بارِ اول، پیش از رندر. `owner` بچه‌ی فعلی است (یا null اگر کسی وارد نیست). */
export function restoreQueries(client: QueryClient, owner: string | null): void {
  let stored: Stored | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    stored = null;
  }
  if (!stored || stored.version !== VERSION || Date.now() - stored.savedAt > MAX_AGE_MS) return;

  const sameOwner = owner !== null && stored.owner === owner;
  const queries = stored.state.queries.filter((q) => {
    const scope = persistScope(q.queryKey);
    return scope === 'shared' || (scope === 'personal' && sameOwner);
  });
  hydrate(client, { ...stored.state, mutations: [], queries });
}

/** از این به بعد هر پاسخِ موفقِ همان فهرست نوشته می‌شود (با کمی تأخیر) */
export function persistQueries(client: QueryClient, owner: () => string | null): () => void {
  let timer: number | null = null;

  const save = () => {
    timer = null;
    const who = owner();
    const state = dehydrate(client, {
      shouldDehydrateQuery: (query) => {
        const scope = persistScope(query.queryKey);
        if (!scope || query.state.status !== 'success') return false;
        return scope === 'shared' || who !== null;
      },
    });
    const stored: Stored = { version: VERSION, savedAt: Date.now(), owner: who, state };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // حافظه پر است: دست‌کم مسیرِ کلاس بماند، که بی‌آن هیچ بازی‌ای باز نمی‌شود
      try {
        const shared = { ...state, queries: state.queries.filter((q) => persistScope(q.queryKey) === 'shared') };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, owner: null, state: shared }));
      } catch {
        /* چیزی نمی‌شود کرد */
      }
    }
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (!persistScope(event.query.queryKey)) return;
    if (event.type !== 'updated' && event.type !== 'removed') return;
    if (timer === null) timer = window.setTimeout(save, SAVE_DELAY_MS);
  });

  return () => {
    unsubscribe();
    if (timer !== null) window.clearTimeout(timer);
  };
}
