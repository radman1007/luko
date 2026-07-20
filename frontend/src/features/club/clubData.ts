// TODO: بعد از آماده شدن بک‌اند، مأموریت‌ها و فروشگاه از API می‌آیند (clubService)
import {
  HiOutlineArrowsUpDown,
  HiOutlineBolt,
  HiOutlineBookOpen,
  HiOutlineCloud,
  HiOutlineFaceSmile,
  HiOutlineGift,
  HiOutlineMapPin,
  HiOutlinePaintBrush,
  HiOutlinePuzzlePiece,
  HiOutlineSparkles,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import type { Mission, ShopItem } from './types';

export const DAILY_MISSIONS: Mission[] = [
  { id: 'game', title: 'یه بازی رو کامل کن', coinReward: 10, icon: HiOutlinePuzzlePiece },
  { id: 'mood', title: 'حالت رو به دکتر نیلا بگو', coinReward: 5, icon: HiOutlineFaceSmile },
  { id: 'breath', title: 'یه دور نفس جادویی برو', coinReward: 5, icon: HiOutlineCloud },
  { id: 'book', title: 'یه درس از کتابت بخون', coinReward: 10, icon: HiOutlineBookOpen },
];

export const SPORT_TASKS: Mission[] = [
  { id: 'sport-run', title: 'یه دقیقه درجا بدو', coinReward: 10, icon: HiOutlineBolt },
  { id: 'sport-jump', title: 'ده تا پروانه بزن', coinReward: 10, icon: HiOutlineSparkles },
  { id: 'sport-squat', title: 'هشت بار بشین‌پاشو', coinReward: 10, icon: HiOutlineArrowsUpDown },
  { id: 'sport-walk', title: 'با خانواده پیاده‌روی کن', coinReward: 15, icon: HiOutlineMapPin },
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'sticker', title: 'برچسب قهرمانی', cost: 40, icon: HiOutlineSparkles },
  { id: 'paint', title: 'رنگ مخصوص باغچه', cost: 70, icon: HiOutlinePaintBrush },
  { id: 'gift', title: 'جعبه‌ی شانس', cost: 100, icon: HiOutlineGift },
  { id: 'cup', title: 'کاپ کوچولوی طلایی', cost: 180, icon: HiOutlineTrophy },
];

export const WEEK_DAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
