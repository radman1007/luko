// TODO: بعد از آماده شدن بک‌اند، وضعیت باغچه و شبنم از API می‌آید (gardenService)
import type { PlantKind } from './types';

/** کلید ذخیره‌سازی محلی وضعیت باغچه (نسخه‌ی مستقل از باغچه‌ی قدیمیِ سلامت) */
export const GARDEN_KEY = 'luko_garden_state';

/** مقدار شبنمی که هر منبع می‌دهد */
export const DEW_REWARD = {
  time: 2, // هر بازه‌ی حضور در سایت
  game: 6, // تکمیل هر بازه
  mission: 3, // هر مأموریت باشگاه
  medal: 15, // باز شدن هر مدال جدید
} as const;

/** آب‌پاش: شارژِ آب که به‌مرور پر می‌شود (مثل انرژی) */
export const WATER = {
  refillMs: 20 * 60 * 1000, // هر ۲۰ دقیقه یک شارژ
  baseMax: 5, // ظرفیت پایه
  perPlotLevel: 2, // +۲ ظرفیت به ازای هر ارتقای باغچه
} as const;

/** هر ۳ دقیقه حضورِ فعال در سایت، یک بار شبنمِ زمان می‌دهد (سقف روزانه) */
export const TIME_DEW = {
  chunkMs: 3 * 60 * 1000,
  dailyCap: 30,
} as const;

export const CARE_PER_STAGE = 4; // امتیاز مراقبت برای هر مرحله‌ی رشد
export const MAX_STAGE = 5;
export const WATER_CARE = 1; // افزایش مراقبت با هر آبیاری
export const FERT_CARE = 3; // افزایش مراقبت با هر کوددهی

export const SLOTS_BASE = 3; // جای کاشت در سطح ۱
export const SLOTS_PER_LEVEL = 1; // +۱ جای کاشت به ازای هر ارتقا
export const MAX_PLOT_LEVEL = 4;

export interface PlantMeta {
  kind: PlantKind;
  name: string;
  /** رنگ اصلی گل/میوه — صحنه از این‌ها SVG می‌سازد */
  bloom: string;
  bloomDark: string;
}

export const PLANTS: Record<PlantKind, PlantMeta> = {
  sunflower: { kind: 'sunflower', name: 'آفتابگردان', bloom: '#f4b400', bloomDark: '#d68f00' },
  tulip: { kind: 'tulip', name: 'لاله', bloom: '#e5484d', bloomDark: '#c02f34' },
  tomato: { kind: 'tomato', name: 'گوجه', bloom: '#e8552f', bloomDark: '#c23c1c' },
  sapling: { kind: 'sapling', name: 'نهال', bloom: '#5fa845', bloomDark: '#437a30' },
  clover: { kind: 'clover', name: 'شبدر', bloom: '#5bbf6a', bloomDark: '#3f9a4e' },
};

export const PLANT_KINDS = Object.keys(PLANTS) as PlantKind[];

export type ShopKind = 'seed' | 'fertilizer' | 'plot' | 'decor';

export interface GardenShopItem {
  id: string;
  title: string;
  desc: string;
  cost: number;
  kind: ShopKind;
  /** برای decor: شناسه‌ی تزئین؛ برای seed: نوع دانه (اختیاری) */
  payload?: string;
}

export const GARDEN_SHOP: GardenShopItem[] = [
  { id: 'seed-pack', title: 'پاکت دانه', desc: 'یک دانه‌ی تازه برای کاشت', cost: 8, kind: 'seed' },
  { id: 'fertilizer', title: 'کیسه کود', desc: 'دو واحد کود برای رشد سریع‌تر', cost: 12, kind: 'fertilizer' },
  { id: 'plot', title: 'بزرگ‌تر کردن باغچه', desc: 'جای کاشت و ظرفیت آب بیشتر', cost: 30, kind: 'plot' },
  { id: 'decor-butterfly', title: 'پروانه‌ها', desc: 'پروانه‌های بازیگوش دور باغچه', cost: 20, kind: 'decor', payload: 'butterfly' },
  { id: 'decor-lantern', title: 'فانوس باغ', desc: 'یک فانوس گرم گوشه‌ی باغچه', cost: 24, kind: 'decor', payload: 'lantern' },
  { id: 'decor-pond', title: 'آبنمای کوچک', desc: 'یک برکه‌ی زلال کنار گیاه‌ها', cost: 28, kind: 'decor', payload: 'pond' },
];

export type Season = 'autumn' | 'winter' | 'spring';

export interface SeasonInfo {
  season: Season;
  label: string;
  /** درصد پیشرفت در سال تحصیلی (۰ تا ۱) */
  progress: number;
}

const YEAR_DAYS = 270; // یک سال تحصیلی ~ ۹ ماه

/** فصل و پیشرفت سال تحصیلی را از زمان شروع باغچه حساب می‌کند */
export function seasonFrom(seasonStartAt: number, now = Date.now()): SeasonInfo {
  const days = Math.max(0, (now - seasonStartAt) / (24 * 60 * 60 * 1000));
  const progress = Math.min(1, days / YEAR_DAYS);
  const season: Season = progress < 1 / 3 ? 'autumn' : progress < 2 / 3 ? 'winter' : 'spring';
  const label = season === 'autumn' ? 'پاییز' : season === 'winter' ? 'زمستان' : 'بهار';
  return { season, label, progress };
}
