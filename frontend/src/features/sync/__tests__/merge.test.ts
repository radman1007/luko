/**
 * ادغامِ دو دستگاه: هیچ‌کدام کارِ دیگری را پاک نمی‌کند و چیزی دوبل نمی‌شود.
 */
import { describe, expect, it } from 'vitest';
import { mergeGarden, mergeSet, mergeValue } from '../merge';
import { strategyFor } from '../syncKeys';

const J = JSON.stringify;

describe('فقط یک طرف عوض شده', () => {
  it('همان می‌ماند — حتی حذف', () => {
    expect(mergeValue('counter', '100', '130', '100')).toBe('130'); // فقط این دستگاه
    expect(mergeValue('counter', '100', '100', '150')).toBe('150'); // فقط دستگاهِ دیگر
    expect(mergeValue('scalar', '{"lvl":2}', null, '{"lvl":2}')).toBeNull(); // این‌جا پاک شد
    expect(mergeValue('scalar', '{"lvl":2}', '{"lvl":2}', null)).toBeNull(); // آن‌جا پاک شد
    expect(mergeValue('set', undefined, null, J(['a']))).toBe(J(['a'])); // دستگاهِ تازه
    expect(mergeValue('set', undefined, J(['a']), null)).toBe(J(['a'])); // سرورِ خالی
  });
});

describe('هر دو عوض شده‌اند', () => {
  it('سکه‌ی گوشی و سکه‌ی سایت جمع می‌شوند؛ خرج هم', () => {
    // پایه ۱۰۰؛ گوشی ۳۰ گرفت، سایت ۵۰ گرفت → ۱۸۰
    expect(mergeValue('counter', '100', '130', '150')).toBe('180');
    // گوشی ۸۰ خرج کرد، سایت ۱۰ گرفت → ۳۰
    expect(mergeValue('counter', '100', '20', '110')).toBe('30');
    // منفی نمی‌شود
    expect(mergeValue('counter', '100', '0', '0')).toBe('0');
  });

  it('بارِ اولِ یک دستگاه: بیشینه، نه جمع (سکه دوبل نشود)', () => {
    expect(mergeValue('counter', undefined, '120', '500')).toBe('500');
    expect(mergeValue('counter', undefined, '800', '500')).toBe('800');
  });

  it('فهرست: اضافه‌های هر دو می‌ماند، حذفِ هر طرف اعمال می‌شود', () => {
    const base = J(['a', 'b']);
    // این‌جا c اضافه و b حذف شد؛ آن‌جا d اضافه شد
    expect(mergeValue('set', base, J(['a', 'c']), J(['a', 'b', 'd']))).toBe(J(['a', 'd', 'c']));
    // بی‌پایه: اجتماع
    expect(mergeValue('set', undefined, J(['x', 'y']), J(['y', 'z']))).toBe(J(['y', 'z', 'x']));
  });

  it('رازها به شناسه و نقاشی‌ها به زمان؛ حذف‌شده برنمی‌گردد', () => {
    const s1 = { id: 's1', title: 'a', payload: 'enc1', createdAt: 1 };
    const s2 = { id: 's2', title: 'b', payload: 'enc2', createdAt: 2 };
    const s3 = { id: 's3', title: 'c', payload: 'enc3', createdAt: 3 };
    // این‌جا s2 حذف شد، آن‌جا s3 اضافه شد
    expect(JSON.parse(mergeValue('list-id', J([s1, s2]), J([s1]), J([s1, s2, s3]))!)).toEqual([s1, s3]);
    const art = (at: number) => ({ at, mood: null, colors: {}, thumbnail: `t${at}` });
    expect(JSON.parse(mergeValue('list-at', J([art(1)]), J([art(3), art(1)]), J([art(2), art(1)]))!).map((a: { at: number }) => a.at))
      .toEqual([3, 2, 1]);
  });

  it('تنظیمات: هر فیلد جدا', () => {
    const base = J({ sound: true, moodReminder: true });
    const local = J({ sound: false, moodReminder: true });   // صدا این‌جا خاموش شد
    const server = J({ sound: true, moodReminder: false });  // یادآور آن‌جا خاموش شد
    expect(JSON.parse(mergeValue('object', base, local, server)!)).toEqual({ sound: false, moodReminder: false });
    // بی‌پایه: تنظیمِ حساب برنده است
    expect(JSON.parse(mergeValue('object', undefined, J({ sound: true }), J({ sound: false }))!)).toEqual({ sound: false });
  });

  it('ذخیره‌ی بازی: با پایه آخرین تغییرِ همین‌جا، بی‌پایه نسخه‌ی حساب', () => {
    expect(mergeValue('scalar', 'v1', 'v2-here', 'v2-there')).toBe('v2-here');
    expect(mergeValue('scalar', undefined, 'fresh-install', 'account-save')).toBe('account-save');
  });

  it('حذف در یک طرف و تغییر در طرفِ دیگر: تغییر گم نمی‌شود', () => {
    expect(mergeValue('scalar', 'v1', null, 'v2')).toBe('v2');
    expect(mergeValue('counter', '5', '9', null)).toBe('9');
  });

  it('زمانِ آخرین ثبتِ حال: آخرینش', () => {
    expect(mergeValue('max', '10', '30', '20')).toBe('30');
  });

  it('مقدارِ خراب ادغام را نمی‌شکند', () => {
    expect(mergeValue('set', J(['a']), '{broken', J(['a', 'b']))).toBe('{broken');
  });
});

describe('باغچه', () => {
  const plant = (id: string, care: number) => ({ id, kind: 'tulip', plantedAt: 1, care });
  const garden = (over: Record<string, unknown>) => ({
    dew: 20, dewLog: [], fertilizer: 1, seeds: 2, plants: [plant('p1', 2)], plotLevel: 1, decor: [],
    waterCharges: 5, lastRefillAt: 100, seasonStartAt: 1, lastWateredAt: null, ...over,
  });

  it('شبنم و مراقبتِ هر دو دستگاه جمع می‌شود، گیاهِ تازه‌ی هر طرف می‌ماند', () => {
    const base = garden({});
    const local = garden({ dew: 30, plants: [plant('p1', 4), plant('p2', 0)], lastRefillAt: 300, waterCharges: 3 });
    const server = garden({ dew: 25, plants: [plant('p1', 3)], plotLevel: 2, decor: ['lamp'], lastRefillAt: 200, waterCharges: 4 });
    const out = mergeGarden(base, local, server);
    expect(out.dew).toBe(35);                                   // ۲۰ + ۱۰ + ۵
    expect(out.plotLevel).toBe(2);
    expect(out.decor).toEqual(['lamp']);
    expect(out.lastRefillAt).toBe(300);
    expect(out.waterCharges).toBe(2);                            // ۵ − ۲ − ۱
    expect(out.plants).toEqual([plant('p1', 5), plant('p2', 0)]); // ۲ + ۲ + ۱
  });

  it('شارژِ آب‌پاش از پُرترین طرف بیشتر نمی‌شود', () => {
    const out = mergeGarden(garden({ waterCharges: 0 }), garden({ waterCharges: 5 }), garden({ waterCharges: 5 }));
    expect(out.waterCharges).toBe(5);
  });

  it('گیاهی که یک طرف برداشت کرده برنمی‌گردد', () => {
    const base = garden({ plants: [plant('p1', 2), plant('p2', 1)] });
    const local = garden({ plants: [plant('p1', 2)], dew: 40 });  // p2 این‌جا برداشت شد
    const server = garden({ plants: [plant('p1', 3), plant('p2', 1)] });
    expect(mergeGarden(base, local, server).plants).toEqual([plant('p1', 3)]);
  });

  it('بی‌پایه: باغچه‌ی پربارتر کامل انتخاب می‌شود (نه روی هم)', () => {
    const rich = garden({ plotLevel: 3, plants: [plant('a', 9)] });
    const fresh = garden({});
    expect(mergeGarden(null, fresh, rich)).toEqual(rich);
    expect(mergeGarden(null, rich, fresh)).toEqual(rich);
  });
});

describe('mergeSet', () => {
  it('ترتیبِ سرور حفظ و تکراری حذف می‌شود', () => {
    expect(mergeSet(null, ['b', 'a', 'a'], ['a', 'c'], String)).toEqual(['a', 'c', 'b']);
  });
});

describe('کدام کلیدها هم‌رسان می‌شوند', () => {
  const now = new Date('2026-09-22T10:00:00');

  it('نشست، کش و صف‌ها هرگز', () => {
    for (const key of ['luko_access_token', 'luko_refresh_token', 'luko_session_user', 'luko_guest',
      'luko_query_cache', 'luko_pending_completions', 'luko_pending_events', 'luko_sync_meta',
      'luko_parent_access_token', 'luko_parent_intro_7', 'luko_completed_games', 'luko_treasures']) {
      expect(strategyFor(key, now), key).toBeNull();
    }
  });

  it('داده‌ی بچه با قاعده‌ی خودش', () => {
    expect(strategyFor('luko_coins', now)).toBe('counter');
    expect(strategyFor('luko_garden_state', now)).toBe('garden');
    expect(strategyFor('luko_club_owned', now)).toBe('set');
    expect(strategyFor('luko_secrets', now)).toBe('list-id');
    expect(strategyFor('luko_guide_home-luko', now)).toBe('flag');
  });

  it('کلیدهای روزانه فقط برای چند روزِ اخیر', () => {
    expect(strategyFor('luko_club_done_2026-09-22', now)).toBe('set');
    expect(strategyFor('luko_dew_time_2026-09-20', now)).toBe('counter');
    expect(strategyFor('luko_club_done_2026-09-10', now)).toBeNull();
  });

  it('ذخیره‌ی بازی‌ها (هر کلیدِ غیرِ luko_، و دو کلیدِ luko_ِ بازی‌ها)', () => {
    expect(strategyFor('bambooShop', now)).toBe('scalar');
    expect(strategyFor('fc2', now)).toBe('scalar');
    expect(strategyFor('luko_active_user_cache', now)).toBe('scalar');
    expect(strategyFor('luko_something_new', now)).toBeNull();
  });
});
