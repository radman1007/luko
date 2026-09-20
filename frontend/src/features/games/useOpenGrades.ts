import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { OPEN_GRADES } from '@/lib/grades';

/**
 * کلاس‌هایی که همین حالا بازی دارند (از سرور).
 *
 * فهرستِ ثابت در کد با رسیدنِ بازی‌های کلاس‌های تازه کهنه می‌شد؛ حالا خودِ
 * کاتالوگ جواب می‌دهد. تا وقتی پاسخ نرسیده، همان فهرستِ ثابت به‌کار می‌رود
 * تا فرمِ ثبت‌نام خالی نماند.
 */
export function useOpenGrades(): number[] {
  const { data } = useQuery({
    queryKey: ['games', 'grades'],
    queryFn: async () => {
      const { data } = await apiClient.get('/games/grades');
      return (data.data.grades ?? []) as number[];
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return data && data.length ? data : OPEN_GRADES;
}
