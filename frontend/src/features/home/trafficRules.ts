/**
 * قوانین راهنمایی و رانندگی برای بچه‌ها — هر روز یک قانون نمایش داده می‌شود.
 * هر قانون قرار است بازیِ عملیِ خودش را داشته باشد تا بچه با تمرین یاد بگیرد؛
 * تا وقتی بازیِ یک قانون ساخته نشده، `hasGame: false` بماند.
 */
export interface TrafficRule {
  id: string;
  text: string;
  /** آیا بازیِ عملیِ این قانون آماده است؟ */
  hasGame: boolean;
}

export const TRAFFIC_RULES: TrafficRule[] = [
  { id: 'crosswalk', text: 'همیشه از خط‌کشی عابر پیاده رد شو؛ اون خط‌ها مال توئه!', hasGame: false },
  { id: 'look-both', text: 'قبل از رد شدن: اول چپ، بعد راست، دوباره چپ رو نگاه کن.', hasGame: false },
  { id: 'traffic-light', text: 'چراغ قرمز یعنی بایست؛ سبز که شد، با احتیاط برو.', hasGame: false },
  { id: 'seatbelt', text: 'توی ماشین همیشه کمربند ببند، حتی برای راه‌های کوتاه.', hasGame: false },
  { id: 'helmet', text: 'موقع دوچرخه‌سواری حتماً کلاه ایمنی سرت باشه.', hasGame: false },
  { id: 'no-play-street', text: 'کنار خیابون بازی نکن؛ توپت هم اگه رفت، خودت نرو!', hasGame: false },
  { id: 'hold-hands', text: 'موقع رد شدن از خیابون، دست بزرگ‌ترها رو بگیر.', hasGame: false },
  { id: 'no-behind-bus', text: 'هیچ‌وقت از پشت اتوبوس یا ماشین پارک‌شده رد نشو.', hasGame: false },
  { id: 'bright-clothes', text: 'شب که بیرونی، لباس روشن بپوش تا راننده‌ها ببیننت.', hasGame: false },
  { id: 'sidewalk', text: 'توی پیاده‌رو راه برو، نه لبه‌ی خیابون.', hasGame: false },
];

/** قانونِ امروز — بر اساس شماره‌ی روزِ سال می‌چرخد */
export function todayTrafficRule(): TrafficRule {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return TRAFFIC_RULES[dayOfYear % TRAFFIC_RULES.length];
}

/** یافتن یک قانون با شناسه (برای صفحه‌ی بازی) */
export function trafficRuleById(id: string): TrafficRule | undefined {
  return TRAFFIC_RULES.find((rule) => rule.id === id);
}
