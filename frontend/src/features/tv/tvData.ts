// TODO: بعد از آماده شدن بک‌اند، ویدیوها از API می‌آیند (videoService)
import {
  HiOutlineBeaker,
  HiOutlineBolt,
  HiOutlineCloud,
  HiOutlineMoon,
  HiOutlineMusicalNote,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
  HiOutlineSun,
} from 'react-icons/hi2';
import type { TvVideo } from './types';

export const MOCK_VIDEOS: TvVideo[] = [
  {
    id: 'v1',
    title: 'ماجراهای کاپیتان — قسمت جدید',
    category: 'کارتون',
    durationMinutes: 12,
    views: 1840,
    icon: HiOutlineRocketLaunch,
  },
  {
    id: 'v2',
    title: 'آزمایش آتشفشان خونگی',
    category: 'علمی',
    durationMinutes: 8,
    views: 970,
    icon: HiOutlineBeaker,
  },
  {
    id: 'v3',
    title: 'قصه‌ی شب: ماه و ستاره',
    category: 'قصه',
    durationMinutes: 10,
    views: 2210,
    icon: HiOutlineMoon,
  },
  {
    id: 'v4',
    title: 'آهنگ الفبای شاد',
    category: 'موسیقی',
    durationMinutes: 4,
    views: 3150,
    icon: HiOutlineMusicalNote,
  },
  {
    id: 'v5',
    title: 'چرا آسمون آبیه؟',
    category: 'علمی',
    durationMinutes: 6,
    views: 1420,
    icon: HiOutlineCloud,
  },
  {
    id: 'v6',
    title: 'شبیه‌ساز فضایی لوکو',
    category: 'کارتون',
    durationMinutes: 15,
    views: 780,
    icon: HiOutlineSparkles,
  },
  {
    id: 'v7',
    title: 'قصه‌ی خورشید خانم',
    category: 'قصه',
    durationMinutes: 9,
    views: 1130,
    icon: HiOutlineSun,
  },
  {
    id: 'v8',
    title: 'ترانه‌ی انرژی صبحگاهی',
    category: 'موسیقی',
    durationMinutes: 3,
    views: 2560,
    icon: HiOutlineBolt,
  },
];
