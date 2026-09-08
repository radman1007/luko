import { useAuth } from './context';

/**
 * پایه‌ی تحصیلیِ کاربرِ فعلی.
 *
 * مسیرِ سیزن و کارت‌های خانه از همین می‌خوانند تا هر بچه فقط بازی‌های
 * پایه‌ی خودش را ببیند. مهمان و کاربرِ بی‌پایه به کلاس اول می‌افتند —
 * تنها پایه‌ای که همیشه محتوا داشته.
 */
export function useGrade(): number {
  const { user } = useAuth();
  const grade = Number(user?.grade);
  return Number.isFinite(grade) && grade >= 1 && grade <= 6 ? grade : 1;
}
