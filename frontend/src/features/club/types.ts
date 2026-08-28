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

export interface Medal {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  unlocked: boolean;
}

export interface ShopItem {
  id: string;
  title: string;
  cost: number;
  icon: IconType;
}
