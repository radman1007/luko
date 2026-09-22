/**
 * صفِ تکمیل‌های بی‌اینترنت: بُردِ آفلاین گم نمی‌شود، به ترتیب و فقط به
 * حسابِ همان بچه می‌رود، و سکه‌اش دوبار داده نمی‌شود.
 */
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeGame = vi.fn();
const grantCoins = vi.fn();
const invalidateQueries = vi.fn(async () => undefined);
/** یک خانه‌ی واقعی برای ['games','completed'] تا به‌روزرسانیِ مستقیم را ببینیم */
let progress: { completed: string[]; stars: Record<string, number> } | undefined;
const setQueryData = vi.fn((_key: unknown, update: (old: typeof progress) => typeof progress) => {
  progress = update(progress);
});

vi.mock('../telemetry', () => ({ completeGame, flushEvents: vi.fn(async () => undefined) }));
vi.mock('@/features/club/store', () => ({ grantCoins }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries, setQueryData } }));

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

function signIn(id: string) {
  localStorage.setItem('luko_access_token', `token-${id}`);
  localStorage.setItem('luko_session_user', JSON.stringify({ id, role: 'student', firstName: 'x', lastName: '' }));
}

const ok = (coins = 10, alreadyDone = false) => ({
  alreadyDone, coins, dew: 0, fertilizer: 0, treasures: 0, stars: 3, starsImproved: false,
});
const offline = () => new AxiosError('Network Error', 'ERR_NETWORK');
const rejected = (status: number) =>
  new AxiosError('no', 'ERR_BAD_REQUEST', undefined, null, {
    data: {}, status, statusText: '', headers: {}, config: {} as never,
  });

async function load() {
  vi.resetModules();
  return import('../pendingCompletions');
}

describe('صفِ تکمیلِ آفلاین', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('window', { location: { pathname: '/' } });
    completeGame.mockReset();
    grantCoins.mockReset();
    invalidateQueries.mockClear();
    setQueryData.mockClear();
    progress = undefined;
    signIn('7');
  });

  it('تکرارِ همان مرحله ردیفِ تازه نمی‌سازد و بهترین ستاره می‌ماند', async () => {
    const q = await load();
    q.queueCompletion('g-1', 1);
    q.queueCompletion('g-1', 3);
    q.queueCompletion('g-1', 2);
    const list = JSON.parse(localStorage.getItem('luko_pending_completions')!);
    expect(list).toHaveLength(1);
    expect(list[0].stars).toBe(3);
    expect([...q.pendingSlugs()]).toEqual(['g-1']);
  });

  it('به ترتیبِ بازی‌شدن ارسال می‌شود و بعدش پیشرفتِ سرور تازه می‌شود', async () => {
    const q = await load();
    q.queueCompletion('g-1');
    q.queueCompletion('g-2', 2);
    completeGame.mockResolvedValue(ok());
    const results = await q.flushCompletions();
    expect(completeGame.mock.calls).toEqual([['g-1', undefined], ['g-2', 2]]);
    expect([...results.keys()]).toEqual(['g-1', 'g-2']);
    expect(q.pendingSlugs().size).toBe(0);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['games', 'completed'] });
  });

  it('بی‌اینترنت همه در صف می‌مانند و ترتیب نمی‌شکند', async () => {
    const q = await load();
    q.queueCompletion('g-1');
    q.queueCompletion('g-2');
    completeGame.mockRejectedValue(offline());
    const results = await q.flushCompletions();
    expect(results.size).toBe(0);
    expect(completeGame).toHaveBeenCalledTimes(1); // بعد از اولی دست نگه می‌دارد
    expect([...q.pendingSlugs()]).toEqual(['g-1', 'g-2']);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('ردِ صریحِ سرور (۴۰۳/۴۰۴) از صف بیرون می‌رود؛ ۴۰۱ نه', async () => {
    const q = await load();
    q.queueCompletion('g-gone');
    q.queueCompletion('g-2');
    completeGame.mockRejectedValueOnce(rejected(404)).mockResolvedValueOnce(ok());
    await q.flushCompletions();
    expect(q.pendingSlugs().size).toBe(0);

    q.queueCompletion('g-3');
    completeGame.mockRejectedValueOnce(rejected(401));
    await q.flushCompletions();
    expect([...q.pendingSlugs()]).toEqual(['g-3']);
  });

  it('سکه دوبار داده نمی‌شود', async () => {
    const q = await load();
    // آفلاین برده شد و سکه‌اش همان لحظه رفت
    q.queueCompletion('g-1');
    q.markCompletionGranted('g-1', 10);
    // آفلاین برده شد ولی محلی «قبلاً گرفته» حساب شد، سرور تازه می‌داند
    q.queueCompletion('g-2');
    q.markCompletionGranted('g-2', 0);
    // هنوز تصمیمی نگرفته (صفحه بسته شد) — سکه‌ی سرور همین‌جا
    q.queueCompletion('g-3');
    // صفحه‌ی بازی خودش جایزه‌ی این یکی را می‌دهد
    q.queueCompletion('g-4');
    completeGame.mockResolvedValue(ok(10));
    await q.flushCompletions('g-4');
    expect(grantCoins.mock.calls).toEqual([[10], [10]]); // فقط g-2 و g-3
  });

  it('صفِ یک بچه به حسابِ بچه‌ی دیگرِ همین گوشی نمی‌رود', async () => {
    const q = await load();
    q.queueCompletion('g-1');
    signIn('8');
    expect(q.pendingSlugs().size).toBe(0);
    completeGame.mockResolvedValue(ok());
    await q.flushCompletions();
    expect(completeGame).not.toHaveBeenCalled();
    signIn('7');
    expect([...q.pendingSlugs()]).toEqual(['g-1']);
  });

  it('پیشرفتِ ذخیره‌شده همان لحظه «رفته» می‌شود (نقشه‌ی آفلاینِ بعدی قفل نمی‌ماند)', async () => {
    const q = await load();
    progress = { completed: ['g-0'], stars: { 'g-0': 1 } };
    q.queueCompletion('g-1', 2);
    completeGame.mockResolvedValue({ ...ok(), stars: 2 });
    await q.flushCompletions();
    expect(progress).toEqual({ completed: ['g-0', 'g-1'], stars: { 'g-0': 1, 'g-1': 2 } });
    // تکرار با ستاره‌ی کمتر رکورد را پایین نمی‌آورد
    q.queueCompletion('g-1', 1);
    completeGame.mockResolvedValue({ ...ok(), stars: 1 });
    await q.flushCompletions();
    expect(progress).toEqual({ completed: ['g-0', 'g-1'], stars: { 'g-0': 1, 'g-1': 2 } });
  });

  it('مهمان و بی‌حساب صف ندارند', async () => {
    localStorage.clear();
    const q = await load();
    expect(q.queueCompletion('g-1')).toBe(false);
    expect(q.pendingSlugs().size).toBe(0);
  });
});
