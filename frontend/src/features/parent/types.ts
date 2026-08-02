import type { MoodVariant } from '@/components/ui/icons';

/** فرزندِ متصل به حسابِ والد */
export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  /** پایه‌ی تحصیلی (۱ تا ۶) */
  grade: number;
  school?: string;
  /** آخرین حضور در اپ */
  lastActiveAt: string;
  /** الان داخل اپ است؟ */
  online?: boolean;
}

/** کاشیِ آمارِ بالای داشبورد */
export interface Kpi {
  key: string;
  label: string;
  value: number;
  /** واحدِ کنارِ عدد (دقیقه، درصد، …) */
  unit?: string;
  /** تغییر نسبت به هفته‌ی گذشته (درصد) */
  delta?: number;
  /** بالا رفتنِ این عدد خوب است؟ (برای رنگ و جهتِ دلتا) */
  higherIsBetter?: boolean;
  hint?: string;
}

/** یک روز از هفته در نمودار فعالیت */
export interface DayActivity {
  /** نامِ کوتاهِ روز */
  day: string;
  minutes: number;
  games: number;
}

/** یک نقطه از روندِ دقت (هر نقطه یک هفته) */
export interface TrendPoint {
  label: string;
  value: number;
}

export type SubjectKey = 'math' | 'science' | 'writing' | 'quran' | 'life';

/** پیشرفتِ یک درس */
export interface SubjectProgressItem {
  key: SubjectKey;
  label: string;
  /** تسلط ۰ تا ۱۰۰ */
  mastery: number;
  gamesDone: number;
  gamesTotal: number;
  trend: 'up' | 'flat' | 'down';
}

/** وضعیتِ یک بازی برای این بچه */
export type GameStatus = 'mastered' | 'progress' | 'struggling' | 'untouched';

/** آمارِ ریزِ یک بازی — چیزی که والد بیشتر از همه دنبالش است */
export interface GameStat {
  id: string;
  title: string;
  subject: SubjectKey;
  subjectLabel: string;
  book: string;
  /** تعداد دفعاتِ بازی */
  attempts: number;
  /** بهترین امتیاز از ۱۰۰ */
  bestScore: number;
  /** درصدِ پاسخ‌های درست */
  accuracy: number;
  /** میانگینِ هر دور (ثانیه) */
  avgSeconds: number;
  /** مجموع زمانِ صرف‌شده (دقیقه) */
  totalMinutes: number;
  /** تعدادِ کمک‌گرفتن/راهنمایی */
  hints: number;
  lastPlayedAt: string;
  coins: number;
  status: GameStatus;
}

/** ثبتِ حالِ روزانه در لوکو سلامت */
export interface MoodEntry {
  /** روزِ کوتاه‌شده برای نمایش */
  day: string;
  mood: MoodVariant;
}

/** یک تحلیلِ تولیدشده (فعلاً نمونه؛ بعداً از سرویسِ هوش مصنوعی می‌آید) */
export interface Insight {
  id: string;
  tone: 'good' | 'watch' | 'tip';
  title: string;
  body: string;
}

/** همه‌ی دیتای داشبوردِ یک بچه */
export interface ChildReport {
  childId: string;
  kpis: Kpi[];
  week: DayActivity[];
  accuracyTrend: TrendPoint[];
  subjects: SubjectProgressItem[];
  games: GameStat[];
  moods: MoodEntry[];
  insights: Insight[];
  wellbeing: {
    checkins: number;
    breathingSessions: number;
    paintings: number;
    dominantMood: MoodVariant;
  };
}
