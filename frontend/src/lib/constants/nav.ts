import type { IconType } from 'react-icons';
import { HiOutlineHome, HiOutlineUser, HiOutlineFire, HiOutlineHeart } from 'react-icons/hi2';
import { SproutIcon } from '@/components/ui/icons';

export interface NavItem {
  label: string;
  path: string;
  icon: IconType;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'کلاب', path: '/luko-club', icon: HiOutlineFire },
  { label: 'باغچه', path: '/garden', icon: SproutIcon },
  { label: 'خانه', path: '/', icon: HiOutlineHome },
  { label: 'سلامت', path: '/luko-health', icon: HiOutlineHeart },
  { label: 'پروفایل', path: '/profile', icon: HiOutlineUser },
];

/**
 * نقشه‌ی مسیرِ سیزن.
 *
 * هرجا برگشت به نقشه لازم شد همین را بردار، نه رشته‌ی خام: یک‌بار چند
 * صفحه مسیر را دستی نوشته بودند و وقتی آدرس عوض شد، کاربر بی‌هیچ خطایی
 * روی صفحه‌ی خانه می‌افتاد.
 *
 * نکته‌ی استقرار: `/games/` در سرور پوشه‌ی واقعیِ فایل‌های بازی هم هست،
 * پس nginx برای این آدرس یک `location =` صریح دارد که SPA را بدهد نه
 * فهرستِ پوشه. (`deploy/nginx.arvan.conf`)
 */
export const SEASON_MAP_PATH = '/games';

/** آدرسِ قدیمیِ نقشه — هنوز در تاریخچه و بوکمارکِ بچه‌ها هست */
export const LEGACY_MAP_PATH = '/books';
