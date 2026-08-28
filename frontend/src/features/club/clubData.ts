// TODO: بعد از آماده شدن بک‌اند، مأموریت‌ها و فروشگاه از API می‌آیند (clubService)
import {
  HiOutlineArrowsUpDown,
  HiOutlineBolt,
  HiOutlineCloud,
  HiOutlineFaceSmile,
  HiOutlineGift,
  HiOutlineMap,
  HiOutlineMapPin,
  HiOutlinePaintBrush,
  HiOutlinePuzzlePiece,
  HiOutlineSparkles,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import type { Mission, ShopItem, SportTask } from './types';

/**
 * مأموریت‌های روزانه. هر کدام باید کاری باشد که پلتفرم خودش می‌بیند —
 * هیچ‌کدام دکمه‌ی «انجام دادم» ندارند. `id` همان کلیدی است که بخشِ مربوطه
 * هنگامِ انجامِ واقعیِ کار با آن `completeMission` را صدا می‌زند.
 */
export const DAILY_MISSIONS: Mission[] = [
  { id: 'game', title: 'یه بازی رو کامل کن', coinReward: 10, icon: HiOutlinePuzzlePiece },
  { id: 'mood', title: 'حالت رو به دکتر نیلا بگو', coinReward: 5, icon: HiOutlineFaceSmile },
  { id: 'breath', title: 'یه دور نفس جادویی برو', coinReward: 5, icon: HiOutlineCloud },
  // جای مأموریتِ «یه دنیای تازه رو باز کن» را گرفت: مدلِ کتاب‌ها با مسیرِ
  // سیزن جایگزین شده و «دنیای تازه» دیگر چیزی نبود که بشود تشخیصش داد.
  { id: 'garden', title: 'به باغچه‌ات آب بده', coinReward: 10, icon: HiOutlineMap },
];

/**
 * تمرین‌های چابک. همه هدایت‌شده‌اند: اپ ریتم و شمارش را نگه می‌دارد و
 * امتیاز فقط وقتی می‌آید که تمرین تا آخر رفته باشد.
 *
 * «پیاده‌رویِ با خانواده» برداشته شد و جایش کششِ هدایت‌شده آمد: پیاده‌روی
 * را اپ به‌هیچ‌روی نمی‌تواند ببیند و تنها راهش پرسیدن از خودِ بچه بود.
 */
export const SPORT_TASKS: SportTask[] = [
  { id: 'sport-run', title: 'یه دقیقه درجا بدو', coinReward: 10, icon: HiOutlineBolt,
    seconds: 60, cue: 'پاها رو تند بالا بیار!' },
  { id: 'sport-jump', title: 'ده تا پروانه بزن', coinReward: 10, icon: HiOutlineSparkles,
    seconds: 20, reps: 10, cue: 'دست‌ها بالا، پاها باز!' },
  { id: 'sport-squat', title: 'هشت بار بشین‌پاشو', coinReward: 10, icon: HiOutlineArrowsUpDown,
    seconds: 24, reps: 8, cue: 'آروم بشین، آروم پاشو.' },
  { id: 'sport-stretch', title: 'دو دقیقه کشش با خانواده', coinReward: 15, icon: HiOutlineMapPin,
    seconds: 120, cue: 'دست‌ها رو بکش بالا و نفس عمیق بکش.' },
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'sticker', title: 'برچسب قهرمانی', cost: 40, icon: HiOutlineSparkles },
  { id: 'paint', title: 'رنگ مخصوص باغچه', cost: 70, icon: HiOutlinePaintBrush },
  { id: 'gift', title: 'جعبه‌ی شانس', cost: 100, icon: HiOutlineGift },
  { id: 'cup', title: 'کاپ کوچولوی طلایی', cost: 180, icon: HiOutlineTrophy },
];

export const WEEK_DAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
