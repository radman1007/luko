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
 * نقشه‌ی مسیرِ سیزن. مسیرِ واقعی `/books` است (مانده از روزهای «کتاب‌ها»)؛
 * چند صفحه به `/games` می‌فرستادند که اصلاً route نیست و کاربر ته‌ی
 * `*` روی خانه می‌افتاد. هرجا برگشت به نقشه لازم شد، همین را بردار.
 */
export const SEASON_MAP_PATH = '/books';
