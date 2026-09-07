import type { IconType } from 'react-icons';

export interface Mission {
  id: string;
  title: string;
  coinReward: number;
  icon: IconType;
}

/**
 * تمرینِ ورزشی. پلتفرم نمی‌تواند حرکتِ بدنِ بچه را ببیند، پس به‌جای
 * پرسیدنِ «انجام دادی؟» خودش تمرین را اجرا می‌کند: شمارش و ریتم را نشان
 * می‌دهد و فقط وقتی تمرین تا آخر رفت امتیاز می‌دهد.
 */
export interface SportTask extends Mission {
  /** کلِ ثانیه‌های تمرین */
  seconds: number;
  /** تمرینِ شمارشی: تعدادِ تکرار (تقسیمِ ثانیه‌ها بین تکرارها) */
  reps?: number;
  /** جمله‌ی راهنما حینِ تمرین */
  cue: string;
}

/**
 * مدال از `./medals` می‌آید — همان‌جا که کاتالوگ و منطقِ پیشرفتش است.
 * این‌جا فقط دوباره صادر می‌شود تا ایمپورت‌های قدیمی نشکنند.
 */
export type { Medal } from './medals';

/**
 * اثرِ خریدِ یک کالا. عمداً صریح است: تا دیروز خرید فقط سکه کم می‌کرد و
 * هیچ‌جای اپ چیزی عوض نمی‌شد. هر کالا یا منبعی به باغچه می‌دهد یا نشانی
 * روی پروفایل می‌گذارد — هر دو جایی که بچه ببیندش.
 */
export interface ShopReward {
  /** دانه‌ی باغچه */
  seeds?: number;
  /** کودِ باغچه */
  fertilizer?: number;
  /** شبنم */
  dew?: number;
}

export interface ShopItem {
  id: string;
  title: string;
  /** بچه باید بداند دقیقاً چه می‌خرد */
  desc: string;
  cost: number;
  icon: IconType;
  /**
   * `pack` بارها خریدنی است و منبع می‌دهد؛ `badge` یک‌بار خریده می‌شود و
   * برای همیشه روی پروفایل می‌ماند.
   */
  kind: 'pack' | 'badge';
  reward?: ShopReward;
  /** فقط برای `badge` — متنی که روی پروفایل می‌نشیند */
  badgeLabel?: string;
  /** صندوقِ شانس: مقدارها تصادفی‌اند */
  random?: boolean;
}
