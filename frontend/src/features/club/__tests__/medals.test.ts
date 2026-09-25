/**
 * منطقِ مدال‌ها.
 *
 * عمداً تابعِ خالص است و UI چیزی حساب نمی‌کند؛ همین تست آن جدایی را
 * قفل می‌کند. شناسه‌ها هم این‌جا بسته می‌شوند: پاداشِ شبنمِ هر مدال با
 * کلیدش در localStorage ذخیره شده و تغییرشان یعنی پاداشِ دوباره.
 */
import { describe, expect, it } from 'vitest';
import { buildMedals, EMPTY_STATS, nextMedal } from '../medals';
import type { MedalStats } from '../medals';

const stats = (over: Partial<MedalStats> = {}): MedalStats => ({ ...EMPTY_STATS, ...over });
const byId = (s: MedalStats, id: string) => buildMedals(s).find((m) => m.id === id)!;

describe('ساختِ مدال‌ها', () => {
  it('بدونِ هیچ فعالیتی، همه بسته‌اند', () => {
    const medals = buildMedals(stats());
    expect(medals.every((m) => !m.unlocked)).toBe(true);
    expect(medals.every((m) => m.current === 0)).toBe(true);
  });

  it('رسیدن به حد، مدال را باز می‌کند', () => {
    expect(byId(stats({ totalTasks: 1 }), 'first').unlocked).toBe(true);
    expect(byId(stats({ streak: 7 }), 'streak7').unlocked).toBe(true);
    expect(byId(stats({ games: 10 }), 'game10').unlocked).toBe(true);
  });

  it('یکی کمتر از حد، هنوز بسته است', () => {
    const medal = byId(stats({ totalTasks: 9 }), 'ten');
    expect(medal.unlocked).toBe(false);
    expect(medal.current).toBe(9);
    expect(medal.target).toBe(10);
  });

  it('پیشرفت از حد بیشتر نمی‌شود', () => {
    const medal = byId(stats({ totalTasks: 999 }), 'ten');
    expect(medal.current).toBe(10);
    expect(medal.ratio).toBe(1);
  });

  it('عددِ منفی صفر حساب می‌شود', () => {
    expect(byId(stats({ treasures: -5 }), 'treasure').current).toBe(0);
  });

  it('نسبت بینِ صفر و یک می‌ماند', () => {
    buildMedals(stats({ totalTasks: 7, streak: 4, games: 3, stars: 9 })).forEach((m) => {
      expect(m.ratio).toBeGreaterThanOrEqual(0);
      expect(m.ratio).toBeLessThanOrEqual(1);
    });
  });

  it('هر مدال رتبه و دسته دارد', () => {
    buildMedals(stats()).forEach((m) => {
      expect(['bronze', 'silver', 'gold']).toContain(m.tier);
      expect(m.description.length).toBeGreaterThan(5);
      expect(m.target).toBeGreaterThan(0);
    });
  });

  it('شناسه‌ها یکتا هستند', () => {
    const ids = buildMedals(stats()).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('شناسه‌های قدیمی حفظ شده‌اند — وگرنه پاداشِ شبنم دوباره داده می‌شود', () => {
    const ids = buildMedals(stats()).map((m) => m.id);
    ['first', 'streak3', 'ten', 'buyer'].forEach((id) => expect(ids).toContain(id));
  });

  it('هر دسته دستِ‌کم یک مدال دارد', () => {
    const cats = new Set(buildMedals(stats()).map((m) => m.category));
    expect(cats).toEqual(new Set(['mission', 'streak', 'game', 'club', 'craft']));
  });
});

describe('نزدیک‌ترین مدال', () => {
  it('وقتی هیچ پیشرفتی نیست، چیزی پیشنهاد نمی‌دهد', () => {
    expect(nextMedal(buildMedals(stats()))).toBeUndefined();
  });

  it('مدالی که به آن نزدیک‌تر است را می‌دهد', () => {
    // ۹ از ۱۰ مأموریت (۹۰٪) در برابر ۱ از ۳ روز (۳۳٪)
    const medal = nextMedal(buildMedals(stats({ totalTasks: 9, streak: 1 })));
    expect(medal?.id).toBe('ten');
  });

  it('مدالِ گرفته‌شده را پیشنهاد نمی‌دهد', () => {
    const medal = nextMedal(buildMedals(stats({ totalTasks: 1 })));
    expect(medal?.unlocked).toBe(false);
  });
});

describe('مدالِ گرفته‌شده پس گرفته نمی‌شود', () => {
  // «سه روز آتشین» از روزهای پیاپیِ همین حالا می‌آید؛ یک روز جاافتادن قفلش می‌کرد
  it('با شکستنِ روزهای پیاپی قفل نمی‌شود', () => {
    const today = buildMedals(stats({ streak: 0 }), new Set(['streak3']));
    const medal = today.find((m) => m.id === 'streak3')!;
    expect(medal.unlocked).toBe(true);
    expect(medal.current).toBe(medal.target);
  });

  it('با خرج کردنِ سکه «سکه‌دارِ لوکو» می‌ماند', () => {
    const medal = buildMedals(stats({ coins: 20 }), new Set(['rich'])).find((m) => m.id === 'rich')!;
    expect(medal.unlocked).toBe(true);
  });

  it('مدالی که هنوز گرفته نشده همان پیشرفتِ واقعی را نشان می‌دهد', () => {
    const medal = buildMedals(stats({ streak: 2 }), new Set(['first'])).find((m) => m.id === 'streak3')!;
    expect(medal.unlocked).toBe(false);
    expect(medal.current).toBe(2);
  });
});
