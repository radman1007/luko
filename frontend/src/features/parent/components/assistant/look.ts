import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineBolt,
  HiOutlineCalculator,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineFaceSmile,
  HiOutlineLanguage,
  HiOutlineLightBulb,
  HiOutlineViewfinderCircle,
} from 'react-icons/hi2';
import type { GrowthKey } from '../../types';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const fa = (n: number) => n.toLocaleString('fa-IR');

/**
 * رنگِ هر بُعدِ رشد — دنباله‌ی دسته‌ای با ترتیبِ ثابت و آزموده با validate_palette (مهارتِ dataviz):
 * روشنایی، کمینه‌ی رنگ‌مایه، جدایی برای کوررنگی (ΔE ۹٫۱) و کنتراست ≥ ۳:۱ روی سفید. رنگ مالِ بُعد است، نه ترتیبِ
 * نمایش؛ بُعدِ قفل هم رنگش را نگه می‌دارد.
 */
export const DIM_LOOK: Record<GrowthKey, { color: string; soft: string; icon: Icon }> = {
  math: { color: '#2f6fd6', soft: '#e8effc', icon: HiOutlineCalculator },
  language: { color: '#d0631f', soft: '#fcece1', icon: HiOutlineLanguage },
  focus: { color: '#1f9d6b', soft: '#e3f4ec', icon: HiOutlineViewfinderCircle },
  mood: { color: '#a24bc2', soft: '#f4e9f8', icon: HiOutlineFaceSmile },
};

/** پرسش‌های آماده‌ی بالای صفحه — هرکدام همان پرسش را با نامِ بچه به دستیار می‌فرستد */
export const QUICK_ASKS: { key: string; label: string; icon: Icon; question: (name: string) => string }[] = [
  {
    key: 'focus', label: 'کمک به تمرکز و توجه', icon: HiOutlineViewfinderCircle,
    question: (name) => `چطور به تمرکز و توجهِ ${name} کمک کنم؟`,
  },
  {
    key: 'week', label: 'این هفته چه تغییراتی داشته؟', icon: HiOutlineCalendarDays,
    question: (name) => `${name} این هفته چه تغییراتی داشته؟`,
  },
  {
    key: 'home', label: 'پیشنهادِ فعالیت برای خانه', icon: HiOutlineLightBulb,
    question: (name) => `یک فعالیتِ ساده برای خانه پیشنهاد بده که به یادگیریِ ${name} کمک کند.`,
  },
  {
    key: 'month', label: 'توضیحِ گزارشِ این ماه', icon: HiOutlineChartBar,
    question: (name) => `گزارشِ چهار هفته‌ی اخیرِ ${name} را ساده برایم توضیح بده.`,
  },
];

/** پرسشِ پیگیری درباره‌ی یکی از کارت‌ها («زمینه‌های نیازمند توجه» و…) */
export const askAbout = (title: string) => `درباره‌ی «${title}» بیشتر توضیح بده و بگو در خانه چه کنم.`;

export const NEXT_ICON = HiOutlineBolt;
