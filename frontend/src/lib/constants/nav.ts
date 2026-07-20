import type { IconType } from 'react-icons';
import {
  HiOutlineHome,
  HiOutlineUser,
  HiOutlineFire,
  HiOutlinePlayCircle,
  HiOutlineHeart,
} from 'react-icons/hi2';

export interface NavItem {
  label: string;
  path: string;
  icon: IconType;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'کلاب', path: '/luko-club', icon: HiOutlineFire },
  { label: 'تلویزیون', path: '/luko-tv', icon: HiOutlinePlayCircle },
  { label: 'خانه', path: '/', icon: HiOutlineHome },
  { label: 'سلامت', path: '/luko-health', icon: HiOutlineHeart },
  { label: 'پروفایل', path: '/profile', icon: HiOutlineUser },
];
