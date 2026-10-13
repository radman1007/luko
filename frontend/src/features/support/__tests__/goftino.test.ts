import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── یک صفحه‌ی کوچکِ ساختگی: فقط چیزهایی که goftino.ts لازم دارد ──
interface FakeScript {
  id: string;
  src: string;
  type: string;
  async: boolean;
  remove: () => void;
}

function makePage(protocol = 'https:', width = 390) {
  const scripts: FakeScript[] = [];
  const handlers = new Map<string, Set<() => void>>();
  const storage = new Map<string, string>();
  const api = {
    setUser: vi.fn(),
    setWidget: vi.fn(),
    unsetUserId: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
  };
  const win: Record<string, unknown> = {
    location: { protocol },
    matchMedia: (query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      return { matches: (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) };
    },
    addEventListener: (name: string, fn: () => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(fn);
    },
    removeEventListener: (name: string, fn: () => void) => handlers.get(name)?.delete(fn),
  };
  const attrs = new Set<string>();
  const doc = {
    documentElement: {
      setAttribute: (name: string) => attrs.add(name),
      removeAttribute: (name: string) => attrs.delete(name),
    },
    getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
    createElement: () => {
      const script: FakeScript = {
        id: '', src: '', type: '', async: false,
        remove: () => scripts.splice(scripts.indexOf(script), 1),
      };
      return script;
    },
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  return {
    attrs,
    scripts,
    storage,
    api,
    /** اسکریپتِ گفتینو رسید و «آماده» شد */
    widgetLoads: () => {
      win.Goftino = api;
      handlers.get('goftino_ready')?.forEach((fn) => fn());
    },
    /** مثلِ اسکریپتِ واقعیِ گفتینو: سراسریِ پاک‌نشدنی (delete روی آن در strict mode خطا می‌دهد) */
    widgetLoadsLocked: () => {
      Object.defineProperty(win, 'Goftino', { value: api, writable: true, enumerable: true, configurable: false });
      handlers.get('goftino_ready')?.forEach((fn) => fn());
    },
    hasGlobal: () => win.Goftino !== undefined,
  };
}

async function freshModule() {
  vi.resetModules();
  return import('../goftino');
}

describe('گفتینو', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('در اپِ اندروید (file://) اصلاً بار نمی‌شود', async () => {
    const page = makePage('file:');
    const g = await freshModule();
    g.loadGoftino();
    expect(page.scripts).toHaveLength(0);
    expect(g.goftinoSupported()).toBe(false);
  });

  it('یک‌بار بار می‌شود، با شناسه‌ی گفتگوی ذخیره‌شده', async () => {
    const page = makePage();
    page.storage.set('goftino_Twz6qn', 'abc123');
    const g = await freshModule();
    g.loadGoftino();
    g.loadGoftino();
    expect(page.scripts).toHaveLength(1);
    expect(page.scripts[0].src).toBe('https://www.goftino.com/widget/Twz6qn?o=abc123');
    expect(page.scripts[0].async).toBe(true);
  });

  it('والد بعد از «آماده» به پشتیبانی معرفی می‌شود (و اگر آماده بود، همان لحظه)', async () => {
    const page = makePage();
    const g = await freshModule();
    g.loadGoftino();
    g.identifyGoftinoUser({ name: 'مریم', phone: '09120000000' });
    expect(page.api.setUser).not.toHaveBeenCalled();
    expect(g.isGoftinoReady()).toBe(false);
    page.widgetLoads();
    expect(g.isGoftinoReady()).toBe(true);
    expect(page.api.setUser).toHaveBeenCalledWith({ name: 'مریم', phone: '09120000000', forceUpdate: true });
    g.identifyGoftinoUser({ name: 'علی' });
    expect(page.api.setUser).toHaveBeenLastCalledWith({ name: 'علی', forceUpdate: true });
  });

  it('بیرون رفتن از پنل: ویجت، اسکریپت و API برداشته می‌شوند و والدِ قبلی دوباره فرستاده نمی‌شود', async () => {
    const page = makePage();
    const g = await freshModule();
    const seen: boolean[] = [];
    g.subscribeGoftino(() => seen.push(g.isGoftinoReady()));
    g.loadGoftino();
    g.identifyGoftinoUser({ name: 'مریم' });
    page.widgetLoads();
    g.removeGoftino();
    expect(page.api.destroy).toHaveBeenCalledTimes(1);
    expect(page.scripts).toHaveLength(0);
    expect(page.hasGlobal()).toBe(false);
    expect(g.isGoftinoReady()).toBe(false);
    expect(seen).toEqual([true, false]);
    // برگشت به پنل (مثلاً مهمان): ویجت تازه بار می‌شود و نامِ قبلی را نمی‌فرستد
    page.api.setUser.mockClear();
    g.loadGoftino();
    expect(page.scripts).toHaveLength(1);
    page.widgetLoads();
    expect(page.api.setUser).not.toHaveBeenCalled();
  });

  it('خروجِ والد گفتگویش را از این مرورگر پاک می‌کند', async () => {
    const page = makePage();
    page.storage.set('goftino_Twz6qn', 'abc123');
    const g = await freshModule();
    g.loadGoftino();
    page.widgetLoads();
    g.forgetGoftinoUser();
    expect(page.api.unsetUserId).toHaveBeenCalledTimes(1);
    expect(page.storage.has('goftino_Twz6qn')).toBe(false);
  });

  it('حباب نه روی منوی پایینِ گوشی می‌افتد نه روی منوی کناریِ لپ‌تاپ', async () => {
    const phone = makePage('https:', 390);
    let g = await freshModule();
    g.loadGoftino();
    phone.widgetLoads();
    expect(phone.api.setWidget).toHaveBeenCalledWith({ marginBottom: 104 });
    vi.unstubAllGlobals();
    const tablet = makePage('https:', 820);
    g = await freshModule();
    g.loadGoftino();
    tablet.widgetLoads();
    expect(tablet.api.setWidget).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const laptop = makePage('https:', 1366);
    g = await freshModule();
    g.loadGoftino();
    laptop.widgetLoads();
    expect(laptop.api.setWidget).toHaveBeenCalledWith({ marginRight: 308 });
  });

  it('سراسریِ پاک‌نشدنیِ گفتینو برداشتن را نمی‌شکند (صفحه از کار نمی‌افتد)', async () => {
    const page = makePage();
    const g = await freshModule();
    g.loadGoftino();
    page.widgetLoadsLocked();
    expect(() => g.removeGoftino()).not.toThrow();
    expect(page.api.destroy).toHaveBeenCalledTimes(1);
    expect(page.scripts).toHaveLength(0);
    expect(g.isGoftinoReady()).toBe(false);
    expect(() => g.openGoftino()).not.toThrow();
    expect(page.api.open).not.toHaveBeenCalled();             // بعد از برداشتن، دیگر به ویجت دست نمی‌زنیم
  });

  it('ویجتی که بعد از برداشتن خودش دوباره بالا بیاید (unsetUserId در خروج) همان‌جا برداشته می‌شود', async () => {
    const page = makePage();
    const g = await freshModule();
    g.loadGoftino();
    page.widgetLoads();
    g.forgetGoftinoUser();                                  // خروجِ والد
    g.removeGoftino();                                      // بیرون رفتن از پنل
    expect(page.api.destroy).toHaveBeenCalledTimes(1);
    page.widgetLoads();                                     // گفتینو خودش برگشت
    expect(page.api.destroy).toHaveBeenCalledTimes(2);
    expect(page.hasGlobal()).toBe(false);
    expect(g.isGoftinoReady()).toBe(false);
    // ولی برگشتِ عمدی به پنل دوباره کار می‌کند
    g.loadGoftino();
    page.widgetLoads();
    expect(g.isGoftinoReady()).toBe(true);
    expect(page.api.destroy).toHaveBeenCalledTimes(2);
  });

  it('حباب تا وقتی شیت یا پنجره‌ای باز است پنهان است (چند پنجره‌ی هم‌زمان هم)', async () => {
    const page = makePage();
    const g = await freshModule();
    const sheet = g.coverGoftino();
    const gate = g.coverGoftino();
    expect(page.attrs.has('data-goftino-covered')).toBe(true);
    sheet();
    sheet();                                                // دوبار بستنِ یک شیت شمارش را خراب نکند
    expect(page.attrs.has('data-goftino-covered')).toBe(true);
    gate();
    expect(page.attrs.has('data-goftino-covered')).toBe(false);
  });

  it('بی‌ویجت هم خروج و بازکردن خطا نمی‌دهند', async () => {
    makePage();
    const g = await freshModule();
    expect(() => g.forgetGoftinoUser()).not.toThrow();
    expect(() => g.openGoftino()).not.toThrow();
    expect(() => g.removeGoftino()).not.toThrow();
  });
});
