/**
 * دو دستگاهِ یک حساب (سایت و اپِ اندروید) با یک سرورِ ساختگی که همان قاعده‌ی
 * نسخه‌ی سرورِ واقعی را دارد: بعد از هم‌رسانی هر دو یک چیز نشان می‌دهند، کارِ
 * هیچ‌کدام گم نمی‌شود، و داده‌ی یک بچه به حسابِ بچه‌ی دیگر نمی‌رود.
 */
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncChange, SyncItem } from '../api';

// ── سرورِ ساختگی: هر حساب جدا، نوشتن فقط روی نسخه‌ی دیده‌شده ──
type Row = { value: string | null; version: number; at: number };
const accounts = new Map<string, Map<string, Row>>();
let clock = 1000;
let offline = false;
let beforePush: (() => unknown) | null = null;
const pushTokens: Array<string | undefined> = [];
/** سکه‌ای که سرور خودش برای هر حساب ثبت کرده (Profile.coins) */
const profileCoins = new Map<string, number>();

function account(): Map<string, Row> {
  const owner = currentDevice.user;
  if (!owner) throw new Error('no session');
  if (!accounts.has(owner)) accounts.set(owner, new Map());
  return accounts.get(owner)!;
}
const network = () => new AxiosError('Network Error', 'ERR_NETWORK');

vi.mock('../api', () => ({
  syncApi: {
    async accountCoins(): Promise<number> {
      if (offline) throw network();
      return profileCoins.get(currentDevice.user ?? '') ?? 0;
    },
    async pull(since: string | null): Promise<{ since: string; items: SyncItem[] }> {
      if (offline) throw network();
      const rows = account();
      const after = since ? Number(since) : -1;
      clock += 1;
      return {
        since: String(clock - 1),
        items: [...rows].filter(([, r]) => r.at > after).map(([key, r]) => ({ key, value: r.value, version: r.version })),
      };
    },
    async push(changes: SyncChange[], token?: string) {
      if (offline) throw network();
      pushTokens.push(token);
      const hook = beforePush?.();
      beforePush = null;
      if (hook === 'session-ended') {
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, null, {
          data: {}, status: 401, statusText: '', headers: {}, config: {} as never,
        });
      }
      const rows = account();
      const applied: Array<{ key: string; version: number }> = [];
      const conflicts: SyncItem[] = [];
      for (const c of changes) {
        const row = rows.get(c.key);
        const current = row?.version ?? 0;
        if (c.baseVersion !== current) {
          conflicts.push({ key: c.key, value: row?.value ?? null, version: current });
          continue;
        }
        clock += 1;
        rows.set(c.key, { value: c.value, version: current + 1, at: clock });
        applied.push({ key: c.key, version: current + 1 });
      }
      return { applied, conflicts };
    },
  },
}));

// ── دستگاه‌ها: هر کدام localStorageِ خودش ──
class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

interface Device { storage: MemoryStorage; user: string | null }
let currentDevice: Device;
const events: string[] = [];

function device(user: string | null, values: Record<string, string> = {}): Device {
  const storage = new MemoryStorage();
  if (user) {
    storage.setItem('luko_access_token', `token-${user}`);
    storage.setItem('luko_session_user', JSON.stringify({ id: user, role: 'student', firstName: 'x', lastName: '' }));
  }
  for (const [k, v] of Object.entries(values)) storage.setItem(k, v);
  return { storage, user };
}

function activate(d: Device) {
  currentDevice = d;
  vi.stubGlobal('localStorage', d.storage);
}

function signIn(d: Device, user: string) {
  d.user = user;
  d.storage.setItem('luko_access_token', `token-${user}`);
  d.storage.setItem('luko_session_user', JSON.stringify({ id: user, role: 'student', firstName: 'x', lastName: '' }));
}

async function sync(d: Device) {
  activate(d);
  const { syncAccount } = await import('../accountSync');
  return syncAccount();
}

beforeEach(() => {
  vi.resetModules();
  accounts.clear();
  profileCoins.clear();
  offline = false;
  beforePush = null;
  pushTokens.length = 0;
  events.length = 0;
  class FakeStorageEvent {
    type: string;
    constructor(type: string, init: { key: string }) {
      this.type = type;
      Object.assign(this, init);
    }
  }
  class FakeCustomEvent {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  }
  vi.stubGlobal('StorageEvent', FakeStorageEvent);
  vi.stubGlobal('CustomEvent', FakeCustomEvent);
  vi.stubGlobal('window', {
    dispatchEvent: (e: { type: string; key?: string }) => { events.push(e.key ?? e.type); return true; },
    setTimeout,
    clearTimeout,
  });
});

const coins = (d: Device) => d.storage.getItem('luko_coins');

describe('سایت و اپِ اندروید برای یک حساب', () => {
  it('دستگاهِ دوم همان داده‌ی حساب را می‌گیرد (نه عددهای خودش)', async () => {
    const web = device('7', {
      luko_coins: '500',
      luko_club_owned: '["badge-star"]',
      luko_garden_state: JSON.stringify({ dew: 90, plotLevel: 3, plants: [{ id: 'p1', care: 12 }], decor: ['lamp'] }),
      bambooShop: '{"themes":["gold"]}',
    });
    await sync(web);

    const phone = device('7', {
      luko_coins: '120',
      luko_garden_state: JSON.stringify({ dew: 20, plotLevel: 1, plants: [{ id: 'fresh', care: 2 }], decor: [] }),
    });
    const outcome = await sync(phone);
    expect(coins(phone)).toBe('500');
    expect(phone.storage.getItem('luko_club_owned')).toBe('["badge-star"]');
    expect(JSON.parse(phone.storage.getItem('luko_garden_state')!).plotLevel).toBe(3);
    expect(phone.storage.getItem('bambooShop')).toBe('{"themes":["gold"]}');
    // فروشگاه‌های اپ با رویدادِ storage باخبر شدند
    expect(outcome?.updated).toEqual(expect.arrayContaining(['luko_coins', 'luko_garden_state', 'bambooShop']));
    expect(events).toContain('luko_coins');
  });

  it('سکه‌ی هر دو دستگاه در یک فاصله جمع می‌شود؛ بعد هر دو یک عدد', async () => {
    const web = device('7', { luko_coins: '200' });
    const phone = device('7');
    await sync(web);
    await sync(phone);
    expect(coins(phone)).toBe('200');

    web.storage.setItem('luko_coins', '230');    // سایت ۳۰ گرفت
    phone.storage.setItem('luko_coins', '250');  // گوشی ۵۰ گرفت (مثلاً آفلاین)
    await sync(web);
    await sync(phone);
    await sync(web);
    expect(coins(phone)).toBe('280');
    expect(coins(web)).toBe('280');
  });

  it('خرید روی یک دستگاه روی دیگری هم کم شده است', async () => {
    const web = device('7', { luko_coins: '300', luko_club_owned: '[]' });
    const phone = device('7');
    await sync(web);
    await sync(phone);
    phone.storage.setItem('luko_coins', '260');
    phone.storage.setItem('luko_club_owned', '["pack-dew"]');
    await sync(phone);
    await sync(web);
    expect(coins(web)).toBe('260');
    expect(web.storage.getItem('luko_club_owned')).toBe('["pack-dew"]');
  });

  it('اگر وسطِ کار دستگاهِ دیگر نوشت، دوباره ادغام و فرستاده می‌شود', async () => {
    const web = device('7', { luko_coins: '100' });
    const phone = device('7');
    await sync(web);
    await sync(phone);
    web.storage.setItem('luko_coins', '110');
    phone.storage.setItem('luko_coins', '150');
    // درست بینِ خواندن و نوشتنِ گوشی، سایت می‌فرستد (نوشتنِ سرور + پایه‌ی خودِ سایت، مثلِ ارسالِ واقعی)
    beforePush = () => {
      const rows = accounts.get('7')!;
      const version = rows.get('luko_coins')!.version + 1;
      rows.set('luko_coins', { value: '110', version, at: ++clock });
      const meta = JSON.parse(web.storage.getItem('luko_sync_meta')!);
      meta.base.luko_coins = '110';
      meta.versions.luko_coins = version;
      web.storage.setItem('luko_sync_meta', JSON.stringify(meta));
    };
    await sync(phone);
    expect(coins(phone)).toBe('160'); // ۱۰۰ + ۱۰ + ۵۰
    await sync(web);
    expect(coins(web)).toBe('160');
  });

  it('بی‌اینترنت چیزی عوض نمی‌شود و بعداً فرستاده می‌شود', async () => {
    const phone = device('7', { luko_coins: '90' });
    offline = true;
    expect(await sync(phone)).toBeNull();
    expect(coins(phone)).toBe('90');
    offline = false;
    await sync(phone);
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('90');
  });

  it('نشست، کش و صف‌ها هرگز فرستاده نمی‌شوند', async () => {
    const web = device('7', { luko_query_cache: '{}', luko_pending_completions: '[]', luko_coins: '1' });
    await sync(web);
    const keys = [...accounts.get('7')!.keys()];
    expect(keys).toContain('luko_coins');
    expect(keys.some((k) => /token|session|query_cache|pending|sync/.test(k))).toBe(false);
  });

  it('مهمان هم‌رسانی ندارد', async () => {
    const guest = device(null, { luko_coins: '999', luko_guest: '1' });
    expect(await sync(guest)).toBeNull();
    expect(accounts.size).toBe(0);
  });
});

describe('چند بچه روی یک گوشی', () => {
  it('داده‌ی بچه‌ی قبلی به حسابِ بچه‌ی بعدی نمی‌رود و برای خودش می‌ماند', async () => {
    const shared = device('7', { luko_coins: '700', bambooShop: '"kid7-save"' });
    await sync(shared);
    shared.storage.setItem('luko_coins', '750'); // هنوز نفرستاده

    // بچه‌ی دیگری روی همین گوشی وارد شد
    accounts.set('8', new Map([['luko_coins', { value: '40', version: 1, at: ++clock }]]));
    signIn(shared, '8');
    await sync(shared);
    expect(coins(shared)).toBe('40');
    expect(shared.storage.getItem('bambooShop')).toBeNull();
    expect([...accounts.get('8')!.keys()]).toEqual(['luko_coins']);
    expect(accounts.get('8')!.get('luko_coins')!.value).toBe('40');

    // بچه‌ی اول برگشت: همان‌جا که بود، با تغییرِ نفرستاده
    signIn(shared, '7');
    await sync(shared);
    expect(coins(shared)).toBe('750');
    expect(shared.storage.getItem('bambooShop')).toBe('"kid7-save"');
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('750');
  });

  it('نشست وسطِ هم‌رسانی بسته شد (ورود با گوشیِ دیگر): داده کنار می‌ماند، بعداً فرستاده می‌شود', async () => {
    const web = device('7', { luko_coins: '100' });
    await sync(web);
    web.storage.setItem('luko_coins', '140');
    const { setAsideSession } = await import('../accountSync');
    // سرور نشست را رد کرد: اینترسپتور توکن را برمی‌دارد و رویدادِ «نشست بسته شد» می‌آید
    beforePush = () => {
      web.storage.removeItem('luko_access_token');
      web.storage.removeItem('luko_session_user');
      setAsideSession();
      return 'session-ended';
    };
    await sync(web);
    expect(coins(web)).toBeNull();                              // مهمانِ بعدی سکه‌ی او را نمی‌بیند
    expect(web.storage.getItem('luko_sync_meta')).toBeNull();   // پایه‌ی بی‌داده نماند
    expect(web.storage.getItem('luko_sync_stash_7')).not.toBeNull();
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('100');

    signIn(web, '7');
    await sync(web);
    expect(coins(web)).toBe('140');
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('140');
  });

  it('خروج: آخرین تغییر با توکنِ خودِ بچه فرستاده و داده‌اش از گوشی برداشته می‌شود', async () => {
    const phone = device('7', { luko_coins: '300' });
    await sync(phone);
    phone.storage.setItem('luko_coins', '320');
    activate(phone);
    const { leaveAccount } = await import('../accountSync');
    await leaveAccount();
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('320');
    expect(pushTokens.at(-1)).toBe('token-7');
    expect(coins(phone)).toBeNull();
    expect(phone.storage.getItem('luko_sync_stash_7')).toBeNull(); // فرستاده شد، کنارگذاشته لازم نیست
  });

  it('خروجِ بی‌اینترنت: داده کنار می‌ماند تا همان بچه برگردد', async () => {
    const phone = device('7', { luko_coins: '300' });
    await sync(phone);
    phone.storage.setItem('luko_coins', '333');
    activate(phone);
    offline = true;
    const { leaveAccount } = await import('../accountSync');
    await leaveAccount();
    expect(coins(phone)).toBeNull();
    expect(phone.storage.getItem('luko_sync_stash_7')).not.toBeNull();
    // خودِ خروج توکن‌ها را برمی‌دارد (authApi.logout)
    phone.storage.removeItem('luko_access_token');
    phone.storage.removeItem('luko_session_user');
    phone.user = null;
    offline = false;
    await sync(phone); // کسی وارد نیست — کاری نمی‌کند
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('300');
    // همان بچه برگشت: تغییرِ نفرستاده‌اش از کنارگذاشته می‌آید و فرستاده می‌شود
    signIn(phone, '7');
    await sync(phone);
    expect(coins(phone)).toBe('333');
    expect(accounts.get('7')!.get('luko_coins')!.value).toBe('333');
  });
});

describe('بارِ اولِ ورود', () => {
  it('حسابِ تازه روی دستگاهِ تازه: صفر سکه', async () => {
    const phone = device('kid-a');
    await sync(phone);
    expect(coins(phone)).toBeNull();
    expect(accounts.get('kid-a')?.has('luko_coins') ?? false).toBe(false);
  });

  // دستگاهی که پیش از این نسخه باز شده بود کیفِ خالی را با ۱۲۰ پر کرده بود و
  // ادغامِ بارِ اول (بیشینه) همان را روی حساب می‌نشاند
  it('۱۲۰ سکه‌ی ساختگیِ نسخه‌ی قبل به حساب نمی‌رسد', async () => {
    const web = device('kid-a', { luko_coins: '40' });
    await sync(web);
    const phone = device('kid-a', { luko_coins: '120' });
    await sync(phone);
    expect(coins(phone)).toBe('40');
    expect(accounts.get('kid-a')?.get('luko_coins')?.value).toBe('40');
  });

  it('۱۲۰ای که ردِ بازی دارد واقعی است و می‌ماند', async () => {
    const phone = device('kid-a', { luko_coins: '120', luko_club_total: '3' });
    await sync(phone);
    expect(coins(phone)).toBe('120');
  });

  it('حسابی که پیش از هم‌رسانی بازی کرده: موجودیِ سرور، نه صفر', async () => {
    profileCoins.set('kid-a', 70);
    const phone = device('kid-a');
    await sync(phone);
    expect(coins(phone)).toBe('70');
    expect(accounts.get('kid-a')?.get('luko_coins')?.value).toBe('70');
  });

  it('کیفِ هم‌رسان‌شده‌ی حساب بر عددِ سرور مقدم است', async () => {
    profileCoins.set('kid-a', 70);
    const web = device('kid-a', { luko_coins: '25' });
    await sync(web);
    const phone = device('kid-a');
    await sync(phone);
    expect(coins(phone)).toBe('25');
  });
});
