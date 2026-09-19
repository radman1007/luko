/**
 * مسیرِ سیزن از دادهٔ سرور.
 *
 * هفته‌ها، ترتیب و قفل از همان چیزی می‌آیند که `GET /games/path` می‌دهد؛
 * فرانت دیگر چیزی از نامِ فایل یا کتاب نمی‌داند. این تست‌ها همین قرارداد
 * را قفل می‌کنند.
 */
import { describe, expect, it } from 'vitest';
import { STAGE_LOOKS, seasonState, toSeasonStages } from '../seasonData';
import type { PathStage } from '../api';
import { FIXTURE_PATH, dayOfWeek } from './fixturePath';

const ids = (stages: { id: string }[]) => stages.map((s) => s.id);

describe('هفته‌ها از سرور', () => {
  it('اندازه‌ی هر هفته همان است که سرور گفته، نه دسته‌های ثابت', () => {
    const state = seasonState(FIXTURE_PATH, new Set(), dayOfWeek(9));
    expect(state.weeks.map((w) => w.stages.length)).toEqual([3, 2, 4, 1, 2]);
    expect(state.totalWeeks).toBe(5);
  });

  it('هفته‌های نرسیده پشتِ ابرند', () => {
    const state = seasonState(FIXTURE_PATH, new Set(), dayOfWeek(2));
    expect(state.openWeeks.map((w) => w.index)).toEqual([1, 2]);
    expect(state.cloudedWeeks.map((w) => w.index)).toEqual([3, 4, 5]);
    expect(state.openStages).toBe(5);
    expect(state.hiddenStages).toBe(7);
    expect(state.daysToNextWeek).toBe(7);
  });

  it('پیش از شروعِ سیزن هیچ هفته‌ای باز نیست', () => {
    const state = seasonState(FIXTURE_PATH, new Set(), new Date(2026, 6, 1));
    expect(state.openWeeks).toEqual([]);
    expect(state.nextStage).toBeUndefined();
  });
});

describe('قفلِ پشتِ‌سرهم', () => {
  it('اولین نرفته نوبتِ بچه است و بعدی‌ها قفل‌اند', () => {
    const [a, b] = ids(FIXTURE_PATH);
    const state = seasonState(FIXTURE_PATH, new Set([a]), dayOfWeek(5));
    const stages = state.weeks.flatMap((w) => w.stages);
    expect(state.nextStage?.id).toBe(b);
    expect(stages.find((s) => s.id === a)?.locked).toBe(false);
    expect(stages.find((s) => s.id === b)?.locked).toBe(false);
    expect(stages.slice(2).every((s) => s.locked)).toBe(true);
  });

  it('مرحله‌ی رفته همیشه باز است، حتی اگر قبلی‌اش نرفته باشد', () => {
    // بعد از جابه‌جاییِ فایل‌ها ممکن است بچه مرحله‌ی جلوتری را رفته باشد
    const all = ids(FIXTURE_PATH);
    const state = seasonState(FIXTURE_PATH, new Set([all[0], all[4]]), dayOfWeek(5));
    const stages = state.weeks.flatMap((w) => w.stages);
    expect(state.nextStage?.id).toBe(all[1]);
    expect(stages[4].locked).toBe(false);
    expect(stages[3].locked).toBe(true);
  });

  it('ترتیب همان ترتیبِ سرور است', () => {
    const state = seasonState(FIXTURE_PATH, new Set(), dayOfWeek(9));
    expect(state.weeks.flatMap((w) => w.stages).map((s) => s.order)).toEqual(
      FIXTURE_PATH.map((s) => s.order),
    );
  });
});

describe('بازی‌محور، نه درس‌محور', () => {
  it('مرحله‌ها هیچ فیلدی از کتاب یا درس ندارند', () => {
    toSeasonStages(FIXTURE_PATH).forEach((stage) => {
      expect(Object.keys(stage).sort()).toEqual(
        ['coinReward', 'id', 'locked', 'look', 'maxStars', 'order', 'stars', 'title', 'week'],
      );
    });
  });

  it('ظاهرِ گره‌ها از جایگاه می‌آید و چرخشی است', () => {
    const looks = toSeasonStages(FIXTURE_PATH).map((s) => s.look);
    looks.forEach((look, i) => expect(look).toBe(i % STAGE_LOOKS));
  });
});

describe('بازیِ تازه', () => {
  it('اضافه‌شدنِ مرحله به ته، چیزی از قبلی‌ها را عوض نمی‌کند', () => {
    const today = dayOfWeek(9);
    const done = new Set(ids(FIXTURE_PATH).slice(0, 4));
    const before = seasonState(FIXTURE_PATH, done, today).weeks.flatMap((w) => w.stages);
    const extra: PathStage = {
      id: 'g-new00001', title: 'تازه', order: 13, week: 6, coinReward: 10, maxStars: 3,
    };
    const after = seasonState([...FIXTURE_PATH, extra], done, today).weeks.flatMap((w) => w.stages);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.at(-1)?.week).toBe(6);
  });

  it('مسیرِ خالی (کلاسی که هنوز بازی ندارد) چیزی را نمی‌شکند', () => {
    const state = seasonState([], new Set(), dayOfWeek(3));
    expect(state.totalStages).toBe(0);
    expect(state.nextStage).toBeUndefined();
    expect(state.photoSpots).toEqual([]);
  });

  it('سقفِ ستاره‌ی هر مرحله از سرور می‌آید', () => {
    const path = FIXTURE_PATH.map((s, i) => (i === 0 ? { ...s, maxStars: 2 } : s));
    const state = seasonState(path, new Set(), dayOfWeek(1));
    expect(state.totalPossibleStars).toBe(2 + 3 + 3);
  });
});
