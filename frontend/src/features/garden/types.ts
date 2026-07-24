/** نوع دانه‌ای که کاشته می‌شود؛ ظاهر گیاه در صحنه از روی همین تعیین می‌شود */
export type PlantKind = 'sunflower' | 'tulip' | 'tomato' | 'sapling' | 'clover';

/** مرحله‌ی رشد گیاه: ۰ دانه، ۱ جوانه، ۲ برگ‌دار، ۳ غنچه، ۴ شکوفه، ۵ کامل */
export type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface Plant {
  id: string;
  kind: PlantKind;
  plantedAt: number;
  /** امتیاز مراقبت انباشته (آبیاری + کوددهی) — مبنای مرحله‌ی رشد */
  care: number;
}

/** از کجا شبنم به دست آمد — برای دفترچه‌ی شبنم و آینده‌ی sync با بک‌اند */
export type DewSource =
  | 'time'
  | 'game'
  | 'mission'
  | 'medal'
  | 'teacher'
  | 'parent'
  | 'shop'
  | 'seed';

export interface DewEntry {
  amount: number;
  source: DewSource;
  at: number;
}

export interface GardenState {
  /** شبنم — ارز ویژه‌ی باغچه */
  dew: number;
  /** دفترچه‌ی آخرین شبنم‌های دریافتی (سقف‌دار) */
  dewLog: DewEntry[];
  /** کود موجود در انبار */
  fertilizer: number;
  /** دانه‌های آماده‌ی کاشت */
  seeds: number;
  /** گیاهان کاشته‌شده در باغچه */
  plants: Plant[];
  /** سطح باغچه: جای کاشت بیشتر + ظرفیت آب بیشتر */
  plotLevel: number;
  /** آیتم‌های تزئینی خریداری‌شده (پروانه، فانوس، حصار، آبنما) */
  decor: string[];
  /** شارژ آب ذخیره‌شده‌ی آب‌پاش هنگام آخرین محاسبه */
  waterCharges: number;
  /** زمان آخرین محاسبه‌ی پر شدن آب‌پاش */
  lastRefillAt: number;
  /** شروع سال تحصیلیِ باغچه — مبنای نمایش پیشرفت فصلی */
  seasonStartAt: number;
  /** زمان آخرین آبیاری (برای انیمیشن و پیام‌ها) */
  lastWateredAt: number | null;
}
