import type { PathStage } from '../api';

/**
 * یک مسیرِ نمونه، به همان شکلی که `GET /games/path` می‌دهد: ۱۲ مرحله در
 * پنج هفته (هفته‌ها اندازه‌ی یکسان ندارند، مثلِ مسیرِ واقعی).
 */
const WEEKS = [3, 2, 4, 1, 2];

export const FIXTURE_PATH: PathStage[] = WEEKS.flatMap((size, w) =>
  Array.from({ length: size }, () => w + 1),
).map((week, i) => ({
  id: `g-${(i + 1).toString(16).padStart(8, '0')}`,
  title: `مرحله ${i + 1}`,
  order: i + 1,
  week,
  coinReward: 10 + i,
  maxStars: 3,
}));

/** روزی که هفته‌ی چندم باز است (شروعِ سیزن + n هفته) */
export function dayOfWeek(week: number): Date {
  return new Date(2026, 7, 8 + (week - 1) * 7, 12);
}
