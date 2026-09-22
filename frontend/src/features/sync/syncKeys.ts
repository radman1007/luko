/**
 * کدام کلیدِ localStorage بینِ دستگاه‌های یک حساب هم‌رسان می‌شود و با چه قاعده‌ای.
 *
 * قاعده‌ها برای وقتی‌اند که هر دو دستگاه از آخرین هم‌رسانی چیزی را عوض کرده‌اند
 * (مثلاً بچه روی گوشی و سایت هر دو سکه گرفته). بقیه‌ی وقت‌ها هر کدام که عوض شده
 * همان می‌ماند — `merge.ts`.
 */
export type Strategy =
  /** موجودی یا شمارنده: تغییرِ هر دو جمع می‌شود (سکه‌ی گوشی + سکه‌ی سایت) */
  | 'counter'
  /** فهرستِ شناسه‌ها: هرچه این‌جا یا آن‌جا اضافه/کم شده */
  | 'set'
  /** بزرگ‌ترین مقدار (زمانِ آخرین ثبتِ حال) */
  | 'max'
  /** شیءِ تنظیمات: هر فیلد جدا */
  | 'object'
  /** فهرستِ شیء با شناسه‌ی `id` (رازها) یا زمانِ `at` (نقاشی‌ها) */
  | 'list-id'
  | 'list-at'
  /** یک‌بار دیده‌شده‌ها (راهنمای هر بخش): اگر یک‌جا دیده شده، همه‌جا دیده شده */
  | 'flag'
  /** باغچه: موجودی‌ها جمع، گیاه‌ها به شناسه، سطح بیشینه */
  | 'garden'
  /** ذخیره‌ی داخلِ بازی‌ها و مقدارهای ساده: آخرین تغییرِ همین دستگاه */
  | 'scalar';

/** مالِ خودِ اپ و هرگز نباید به دستگاهِ دیگر برود (نشست، کش، صف‌ها) یا مالِ سرور است */
const NEVER = new Set([
  'luko_access_token',
  'luko_refresh_token',
  'luko_parent_access_token',
  'luko_parent_refresh_token',
  'luko_session_user',
  'luko_parent_session_user',
  'luko_guest',
  'luko_parent_guest',
  'luko_query_cache',
  'luko_pending_completions',
  'luko_pending_events',
  // مرجعشان سرور است و از آن‌جا خوانده می‌شوند
  'luko_completed_games',
  'luko_treasures',
]);

const EXACT: Record<string, Strategy> = {
  luko_coins: 'counter',
  luko_club_total: 'counter',
  luko_club_days: 'set',
  luko_club_owned: 'set',
  luko_medal_dew: 'set',
  luko_podcast_listened: 'set',
  luko_garden_state: 'garden',
  luko_settings: 'object',
  luko_last_mood_time: 'max',
  luko_last_mood: 'scalar',
  luko_art_log: 'list-at',
  luko_secrets: 'list-id',
  // دو بازی ذخیره‌شان را با پیشوندِ luko_ نگه می‌دارند
  luko_active_user_cache: 'scalar',
  luko_local_users: 'scalar',
};

/** کلیدهای روزانه — فقط همین چند روزِ اخیر ارزش دارند، بقیه فقط جا می‌گیرند */
const DAILY: Array<[RegExp, Strategy]> = [
  [/^luko_club_done_(\d{4}-\d{2}-\d{2})$/, 'set'],
  [/^luko_sport_done_(\d{4}-\d{2}-\d{2})$/, 'set'],
  [/^luko_dew_time_(\d{4}-\d{2}-\d{2})$/, 'counter'],
];
const DAILY_KEEP_DAYS = 2;

function recent(day: string, now: Date): boolean {
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - DAILY_KEEP_DAYS);
  return day >= oldest.toLocaleDateString('en-CA');
}

/** قاعده‌ی هر کلید، یا null یعنی هم‌رسان نمی‌شود */
export function strategyFor(key: string, now: Date = new Date()): Strategy | null {
  if (NEVER.has(key) || key.startsWith('luko_sync_')) return null;
  if (EXACT[key]) return EXACT[key];
  for (const [pattern, strategy] of DAILY) {
    const match = pattern.exec(key);
    if (match) return recent(match[1], now) ? strategy : null;
  }
  if (key.startsWith('luko_guide_')) return 'flag';
  // بقیه‌ی کلیدهای luko_ مالِ خودِ اپ‌اند (پنلِ والدین، …)
  if (key.startsWith('luko_') || key.startsWith('luko-')) return null;
  // هر کلیدِ دیگری را بازی‌ها نوشته‌اند (قالب‌ها، مرحله‌ها، خریدهای داخلِ بازی)
  return 'scalar';
}
