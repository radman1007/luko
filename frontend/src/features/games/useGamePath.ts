import { useQuery } from '@tanstack/react-query';
import { gamesApi } from './api';
import type { PathStage } from './api';

export interface GamePath {
  /** مرحله‌های مسیر؛ تا وقتی نرسیده آرایه‌ی خالی */
  stages: PathStage[];
  /** هنوز حتی یک‌بار نرسیده */
  isLoading: boolean;
  /** نرسید و چیزی هم از قبل نداریم (خطا، یا اینترنتِ قطع) */
  isError: boolean;
  retry: () => void;
}

const EMPTY: PathStage[] = [];

/**
 * مسیرِ بازی‌های کلاسِ بچه، از سرور.
 *
 * کاتالوگ دیگر در کدِ فرانت نیست: بازیِ تازه فقط یک فایل با نامِ درست است و
 * بدونِ بیلدِ دوباره در مسیر پیدا می‌شود. ارجاعِ آرایه پایدار می‌ماند تا
 * چیدمانِ نقشه در هر رندر دوباره حساب نشود.
 */
export function useGamePath(grade: number): GamePath {
  const query = useQuery({
    queryKey: ['games', 'path', grade],
    queryFn: () => gamesApi.path(grade),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  // `isPaused` یعنی مرورگر آفلاین است و درخواست اصلاً فرستاده نشده. بدونِ
  // این، صفحه نه در حالِ بارگذاری بود نه خطا، و بچه پیامِ «بازی‌های این
  // کلاس تو راهن» را می‌دید — انگار محتوایی وجود ندارد.
  const stalled = (query.isError || query.isPaused) && !query.data;
  return {
    stages: query.data ?? EMPTY,
    isLoading: query.isLoading && !query.isPaused,
    isError: stalled,
    retry: () => void query.refetch(),
  };
}
