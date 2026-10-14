import {
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineChatBubbleLeftRight,
  HiOutlineClipboardDocumentList,
  HiOutlineCreditCard,
  HiOutlineMegaphone,
  HiOutlineMicrophone,
  HiOutlineNewspaper,
  HiOutlineTag,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineUsers,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import type { Capability } from '../../types';

export interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  need: Capability | 'superuser';
}

/** ترتیبِ منو = ترتیبِ کارِ روزانه‌ی تیم */
export const NAV: NavItem[] = [
  { to: '/', label: 'نمای کلی', icon: HiOutlineSquares2X2, need: 'stats' },
  { to: '/analytics', label: 'آمار و بازدید', icon: HiOutlineChartBar, need: 'stats' },
  { to: '/users', label: 'کاربران', icon: HiOutlineUsers, need: 'users_view' },
  { to: '/payments', label: 'پرداخت‌ها', icon: HiOutlineCreditCard, need: 'payments' },
  { to: '/tickets', label: 'پشتیبانی', icon: HiOutlineChatBubbleLeftRight, need: 'tickets' },
  { to: '/podcasts', label: 'پادکست‌ها', icon: HiOutlineMicrophone, need: 'podcasts' },
  { to: '/blog', label: 'وبلاگ', icon: HiOutlineNewspaper, need: 'blog' },
  { to: '/learn', label: 'آموزشِ والدین', icon: HiOutlineAcademicCap, need: 'learn' },
  { to: '/concepts', label: 'تگ‌های آموزشی', icon: HiOutlineTag, need: 'concepts' },
  { to: '/notices', label: 'ارسالِ اعلان', icon: HiOutlineMegaphone, need: 'notify' },
  { to: '/staff', label: 'کارمندان و دسترسی', icon: HiOutlineShieldCheck, need: 'superuser' },
  { to: '/audit', label: 'گزارشِ فعالیت', icon: HiOutlineClipboardDocumentList, need: 'audit' },
];
