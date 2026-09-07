/**
 * کاتالوگِ مدال‌ها.
 *
 * تا دیروز مدال‌ها داخلِ `useClub` نوشته شده بودند و فقط «باز/بسته»
 * داشتند. برای تالارِ افتخارات دو چیزِ دیگر لازم بود:
 *
 *   - **پیشرفت**: مدالِ بسته باید بگوید چقدر مانده. «۷ از ۱۰ مأموریت»
 *     بچه را برمی‌گرداند؛ یک قفلِ خاموش نه.
 *   - **رتبه**: برنز/نقره/طلا، تا نگاهِ اول بگوید کدام دستاورد بزرگ‌تر
 *     بوده و تالار صافِ یک‌دست نباشد.
 *
 * منبعِ واحد است: هم صفحه‌ی کلاب از همین می‌خواند هم تالارِ افتخارات.
 * شناسه‌ها عمداً ثابت مانده‌اند (`first`, `streak3`, `ten`, `buyer`) چون
 * پاداشِ شبنمِ هر مدال با همین کلید ذخیره شده و عوض‌کردنشان یعنی پاداشِ
 * دوباره برای چیزی که بچه قبلاً گرفته.
 */
import type { IconType } from 'react-icons';
import {
  HiOutlineBeaker,
  HiOutlineBolt,
  HiOutlineFire,
  HiOutlineGift,
  HiOutlineHeart,
  HiOutlinePaintBrush,
  HiOutlineRocketLaunch,
  HiOutlineShoppingBag,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineSun,
  HiOutlineTrophy,
} from 'react-icons/hi2';

/** رتبه‌ی مدال — از نگاهِ اول بگوید چقدر سخت بوده */
export type MedalTier = 'bronze' | 'silver' | 'gold';

/** دسته، برای گروه‌بندیِ تالار */
export type MedalCategory = 'mission' | 'game' | 'streak' | 'club' | 'craft';

export const CATEGORY_LABEL: Record<MedalCategory, string> = {
  mission: 'مأموریت‌ها',
  streak: 'پشتکار',
  game: 'بازی‌ها',
  club: 'باشگاه',
  craft: 'هنر و گنج',
};

/** هرچه بچه تا حالا انجام داده — ورودیِ محاسبه‌ی مدال‌ها */
export interface MedalStats {
  /** کلِ مأموریت‌های انجام‌شده (کلاب + ورزش) */
  totalTasks: number;
  /** روزهای پیاپی */
  streak: number;
  /** بازی‌های تمام‌شده */
  games: number;
  /** ستاره‌های جمع‌شده در مسیرِ سیزن */
  stars: number;
  /** کالاهای خریداری‌شده */
  purchases: number;
  /** سکه‌های فعلی */
  coins: number;
  /** نقاشی‌های ذخیره‌شده */
  drawings: number;
  /** گنج‌های پیداشده */
  treasures: number;
}

export const EMPTY_STATS: MedalStats = {
  totalTasks: 0,
  streak: 0,
  games: 0,
  stars: 0,
  purchases: 0,
  coins: 0,
  drawings: 0,
  treasures: 0,
};

interface MedalDef {
  id: string;
  title: string;
  /** چطور به‌دستش می‌آورند — روی مدالِ بسته دیده می‌شود */
  description: string;
  icon: IconType;
  tier: MedalTier;
  category: MedalCategory;
  /** چند تا لازم است */
  target: number;
  /** الان چند تا دارد */
  value: (s: MedalStats) => number;
}

/**
 * ترتیب عمدی است: هر دسته از آسان به سخت. تالار به همین ترتیب پر می‌شود
 * و بچه مسیرِ پیشِ رویش را می‌بیند.
 */
const DEFS: MedalDef[] = [
  // ── مأموریت‌ها ────────────────────────────────────────────
  { id: 'first', title: 'اولین قدم', description: 'اولین مأموریتت رو انجام بده',
    icon: HiOutlineStar, tier: 'bronze', category: 'mission',
    target: 1, value: (s) => s.totalTasks },
  { id: 'ten', title: 'ده‌تایی شدی', description: '۱۰ مأموریت کامل کن',
    icon: HiOutlineRocketLaunch, tier: 'silver', category: 'mission',
    target: 10, value: (s) => s.totalTasks },
  { id: 'fifty', title: 'پنجاه‌کار', description: '۵۰ مأموریت کامل کن',
    icon: HiOutlineBolt, tier: 'gold', category: 'mission',
    target: 50, value: (s) => s.totalTasks },

  // ── پشتکار ────────────────────────────────────────────────
  { id: 'streak3', title: 'سه روز آتشین', description: '۳ روز پشتِ سرِ هم تمرین کن',
    icon: HiOutlineFire, tier: 'bronze', category: 'streak',
    target: 3, value: (s) => s.streak },
  { id: 'streak7', title: 'یک هفته‌ی کامل', description: '۷ روز پشتِ سرِ هم تمرین کن',
    icon: HiOutlineSun, tier: 'silver', category: 'streak',
    target: 7, value: (s) => s.streak },
  { id: 'streak30', title: 'ماهِ بی‌وقفه', description: '۳۰ روز پشتِ سرِ هم تمرین کن',
    icon: HiOutlineHeart, tier: 'gold', category: 'streak',
    target: 30, value: (s) => s.streak },

  // ── بازی‌ها ───────────────────────────────────────────────
  { id: 'game1', title: 'بازیکنِ تازه', description: 'اولین مرحله‌ی سیزن رو ببر',
    icon: HiOutlineSparkles, tier: 'bronze', category: 'game',
    target: 1, value: (s) => s.games },
  { id: 'game10', title: 'ماجراجوی مسیر', description: '۱۰ مرحله‌ی سیزن رو ببر',
    icon: HiOutlineTrophy, tier: 'silver', category: 'game',
    target: 10, value: (s) => s.games },
  { id: 'stars15', title: 'ستاره‌چین', description: '۱۵ ستاره از مرحله‌ها بگیر',
    icon: HiOutlineStar, tier: 'gold', category: 'game',
    target: 15, value: (s) => s.stars },

  // ── باشگاه ────────────────────────────────────────────────
  { id: 'buyer', title: 'خریدارِ باشگاه', description: 'اولین جایزه‌ت رو بخر',
    icon: HiOutlineShoppingBag, tier: 'bronze', category: 'club',
    target: 1, value: (s) => s.purchases },
  { id: 'rich', title: 'سکه‌دارِ لوکو', description: '۲۰۰ سکه جمع کن',
    icon: HiOutlineGift, tier: 'silver', category: 'club',
    target: 200, value: (s) => s.coins },

  // ── هنر و گنج ─────────────────────────────────────────────
  { id: 'painter', title: 'نقاشِ کوچولو', description: '۳ نقاشی توی گنجینه‌ت نگه دار',
    icon: HiOutlinePaintBrush, tier: 'bronze', category: 'craft',
    target: 3, value: (s) => s.drawings },
  { id: 'treasure', title: 'گنج‌یاب', description: '۵ گنج پیدا کن',
    icon: HiOutlineBeaker, tier: 'silver', category: 'craft',
    target: 5, value: (s) => s.treasures },
];

export interface Medal {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  unlocked: boolean;
  tier: MedalTier;
  category: MedalCategory;
  /** چند تا دارد (سقفش `target` است، نه بیشتر) */
  current: number;
  target: number;
  /** ۰ تا ۱ */
  ratio: number;
}

/**
 * مدال‌ها برای این آمار. تابعِ خالص است تا هم قابلِ تست باشد هم UI
 * چیزی حساب نکند — همان جدایی‌ای که در نقشه‌ی سیزن هم رعایت شد.
 */
export function buildMedals(stats: MedalStats): Medal[] {
  return DEFS.map((def) => {
    const raw = Math.max(0, def.value(stats));
    const current = Math.min(raw, def.target);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: def.tier,
      category: def.category,
      unlocked: raw >= def.target,
      current,
      target: def.target,
      ratio: def.target > 0 ? current / def.target : 0,
    };
  });
}

/** مدالِ بعدی که بچه به آن نزدیک‌تر است — «چیزی که تا یک قدمی‌اش رسیده» */
export function nextMedal(medals: Medal[]): Medal | undefined {
  return medals
    .filter((m) => !m.unlocked && m.current > 0)
    .sort((a, b) => b.ratio - a.ratio)[0];
}
