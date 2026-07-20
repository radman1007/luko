import { BUILDER_UNLOCK } from './config';

export interface BuilderStats {
  coins: number;
  totalTasks: number;
  streak: number;
  gamesCompleted: number;
}

/** کارگاه فقط وقتی باز می‌شود که همه‌ی شرط‌های BUILDER_UNLOCK برقرار باشند */
export function isBuilderUnlocked(stats: BuilderStats): boolean {
  return (
    stats.coins >= BUILDER_UNLOCK.coins &&
    stats.totalTasks >= BUILDER_UNLOCK.totalTasks &&
    stats.streak >= BUILDER_UNLOCK.streak &&
    stats.gamesCompleted >= BUILDER_UNLOCK.gamesCompleted
  );
}
