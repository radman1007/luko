import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineAcademicCap,
  HiOutlineCog6Tooth,
  HiOutlineHeart,
  HiOutlineHome,
  HiOutlineSparkles,
} from 'react-icons/hi2';

/** صفحه‌های اصلیِ پنل (منو) + دو زیرصفحه که از خانه باز می‌شوند */
export type PanelPage = 'home' | 'health' | 'assistant' | 'learn' | 'settings' | 'details' | 'daily';

export interface NavItem {
  key: PanelPage;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'خانه', icon: HiOutlineHome },
  { key: 'health', label: 'سلامت', icon: HiOutlineHeart },
  { key: 'assistant', label: 'دستیار هوشمند', icon: HiOutlineSparkles },
  { key: 'learn', label: 'آموزش', icon: HiOutlineAcademicCap },
  { key: 'settings', label: 'تنظیمات', icon: HiOutlineCog6Tooth },
];

/** عنوانِ نوارِ بالای هر صفحه */
export const PAGE_TITLES: Record<PanelPage, string> = {
  home: 'خانه',
  health: 'سلامت',
  assistant: 'دستیار هوشمند',
  learn: 'آموزش والدین',
  settings: 'تنظیمات',
  details: 'گزارشِ کامل',
  daily: 'بازی روز',
};

/** زیرصفحه‌ها در منو زیرِ «خانه» حساب می‌شوند */
export function navKeyOf(page: PanelPage): PanelPage {
  return page === 'details' || page === 'daily' ? 'home' : page;
}

const PAGES = new Set<PanelPage>(['home', 'health', 'assistant', 'learn', 'settings', 'details', 'daily']);

/** مقدارِ `?p=` از نشانی؛ ناشناخته یعنی خانه */
export function pageFromParam(value: string | null): PanelPage {
  return value && PAGES.has(value as PanelPage) ? (value as PanelPage) : 'home';
}
