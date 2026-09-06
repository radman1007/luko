/**
 * جمعِ ستاره‌ها و نقاطِ یادگاری.
 *
 * این محاسبه عمداً از UI جداست؛ همین تست آن جدایی را قفل می‌کند —
 * اگر کسی منطق را داخلِ کامپوننت ببرد، این‌جا دیگر قابلِ تست نیست.
 */
import { describe, expect, it } from 'vitest';
import { seasonState } from '../seasonData';

/** همه‌ی مرحله‌های بازشده‌ی امروز */
const openIds = () => seasonState(new Set()).openWeeks.flatMap((w) => w.stages).map((s) => s.id);

describe('ستاره‌های سیزن', () => {
  it('بدونِ پیشرفت، صفر ستاره از یک مخرجِ مثبت', () => {
    const state = seasonState(new Set());
    expect(state.earnedStars).toBe(0);
    expect(state.totalPossibleStars).toBeGreaterThan(0);
    expect(state.starPercent).toBe(0);
  });

  it('مخرج = تعدادِ مرحله‌های بازشده × سقفِ ستاره', () => {
    const state = seasonState(new Set());
    expect(state.totalPossibleStars).toBe(state.openStages * 3);
  });

  it('ستاره‌ها جمع می‌شوند', () => {
    const [a, b, c] = openIds();
    const state = seasonState(new Set([a, b, c]), new Date(), { [a]: 3, [b]: 1, [c]: 2 });
    expect(state.earnedStars).toBe(6);
  });

  it('ستاره‌ی مرحله‌ی نرفته شمرده نمی‌شود', () => {
    const [a, b] = openIds();
    const state = seasonState(new Set([a]), new Date(), { [a]: 2, [b]: 3 });
    expect(state.earnedStars).toBe(2);
  });

  it('Map هم مثلِ آبجکت قبول است', () => {
    const [a] = openIds();
    const state = seasonState(new Set([a]), new Date(), new Map([[a, 3]]));
    expect(state.earnedStars).toBe(3);
  });

  it('درصد از ستاره حساب می‌شود نه از تعدادِ مرحله', () => {
    const ids = openIds();
    const stars = Object.fromEntries(ids.map((id) => [id, 3]));
    const state = seasonState(new Set(ids), new Date(), stars);
    expect(state.starPercent).toBe(100);
  });

  it('نبودِ ستاره چیزی را نمی‌شکند — همان امضای قبلی', () => {
    const state = seasonState(new Set(openIds()));
    expect(state.earnedStars).toBe(0);
    expect(state.completedStages).toBe(state.openStages);
  });

  it('هر مرحله ستاره و سقفش را با خودش دارد', () => {
    const [a] = openIds();
    const stage = seasonState(new Set([a]), new Date(), { [a]: 2 })
      .openWeeks.flatMap((w) => w.stages)
      .find((s) => s.id === a);
    expect(stage?.stars).toBe(2);
    expect(stage?.maxStars).toBe(3);
  });
});

describe('نقاطِ یادگاری', () => {
  it('فقط نقاطی که روی بخشِ بازشده‌ی مسیرند می‌آیند', () => {
    const state = seasonState(new Set());
    state.photoSpots.forEach((spot) => {
      expect(spot.afterStage).toBeLessThanOrEqual(state.openStages);
    });
  });

  it('هر نقطه شناسه و متنِ خودش را دارد', () => {
    seasonState(new Set()).photoSpots.forEach((spot) => {
      expect(spot.id).toBeTruthy();
      expect(spot.prompt.length).toBeGreaterThan(10);
    });
  });
});
