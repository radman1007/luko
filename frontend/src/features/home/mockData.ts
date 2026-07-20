// TODO: بعد از آماده شدن بک‌اند، این داده‌ها از API می‌آیند
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineBookmarkSquare,
  HiOutlineCalculator,
  HiOutlinePencil,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import type { BookPreview } from './types';

export const MOCK_STATS = {
  coins: 120,
  streak: 3,
  xp: 450,
};

/**
 * تمام کتاب‌های پایه‌ی کاربر (فعلاً کلاس اول) — هر کتاب یک «دنیای بازی» است.
 * کتاب‌هایی که هنوز بازی‌شان ساخته نشده هم نمایش داده می‌شوند (gamesCount = 0).
 */
export const MOCK_BOOKS: BookPreview[] = [
  {
    id: 'math-1',
    title: 'ریاضی اول',
    subject: 'ریاضی',
    worldTitle: 'جزیره‌ی اعداد',
    icon: HiOutlineCalculator,
    gamesCount: 10,
  },
  {
    id: 'science-1',
    title: 'علوم اول',
    subject: 'علوم',
    worldTitle: 'آزمایشگاه مخفی',
    icon: HiOutlineBeaker,
    gamesCount: 3,
  },
  {
    id: 'writing-1',
    title: 'نگارش اول',
    subject: 'نگارش',
    worldTitle: 'قصر کلمه‌ها',
    icon: HiOutlinePencil,
    gamesCount: 4,
  },
  {
    id: 'quran-1',
    title: 'قرآن اول',
    subject: 'قرآن',
    worldTitle: 'باغ نور',
    icon: HiOutlineBookOpen,
    gamesCount: 2,
  },
  {
    id: 'reading-1',
    title: 'فارسی: خوانداری',
    subject: 'فارسی',
    worldTitle: 'سرزمین حرف‌ها',
    icon: HiOutlineBookmarkSquare,
    gamesCount: 0,
  },
  {
    id: 'gifts-1',
    title: 'هدیه‌های آسمان',
    subject: 'هدیه‌ها',
    worldTitle: 'کهکشان مهربونی',
    icon: HiOutlineSparkles,
    gamesCount: 0,
  },
];
