import type { MoodVariant } from '@/components/ui/icons';
import type { ChildAnalysis } from './analysis';

/** فرزندِ متصل به حسابِ والد */
export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
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
  /** تعدادِ پاسخ‌های آن هفته؛ ۰ یعنی هفته‌ی بدونِ داده (نه دقتِ صفر) */
  samples?: number;
}

export type SubjectKey = 'math' | 'science' | 'writing' | 'quran' | 'life';

/** پیشرفتِ یک درس */
export interface SubjectProgressItem {
  key: string;
  label: string;
  /** تسلط ۰ تا ۱۰۰ */
  mastery: number;
  gamesDone: number;
  gamesTotal: number;
  trend: 'up' | 'flat' | 'down';
  /** ضعیف‌ترین مبحثِ همین درس (اگر بازی topic بفرستد) */
  weakestTopic?: string;
}

/** وضعیتِ یک بازی برای این بچه */
export type GameStatus = 'mastered' | 'progress' | 'struggling' | 'untouched';

/** آمارِ ریزِ یک بازی — چیزی که والد بیشتر از همه دنبالش است */
export interface GameStat {
  id: string;
  title: string;
  subject: string;
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

/** یک ساعت از شبانه‌روز در نقشه‌ی فعالیت */
export interface HourBucket {
  hour: number;
  count: number;
  /** ۰ تا ۱۰۰ نسبت به پرکارترین ساعت */
  intensity: number;
}

/** یک جلسه‌ی بازی */
export interface PlaySession {
  id: number;
  game: string;
  at: string;
  time: string;
  minutes: number;
  accuracy: number;
  stars?: number | null;
}

/** ریزنمره‌ی یک مبحث */
export interface TopicScore {
  key: string;
  label: string;
  asked: number;
  accuracy: number;
  avgSeconds: number;
}

/** یک تگِ آموزشی (مفهوم) — همان کدی که تیمِ طراحی تعریف می‌کند و بازی روی هر پاسخ می‌فرستد */
export interface ConceptStat {
  tag: string;
  label: string;
  subject: string;
  answers: number;
  errors: number;
  /** درصدِ پاسخ‌های درست */
  accuracy: number;
  /** پاسخ‌هایی که «اولین تلاش» بودند */
  firstTryAsked: number;
  firstTryRate: number;
  avgSeconds: number;
  hints: number;
  /** نوعِ خطاها، پرتکرار اول */
  errorTypes: { key: string; label: string; count: number }[];
}

export interface FirstTry {
  asked: number;
  correct: number;
  rate: number;
}

/** یادگیری بر پایه‌ی تگ‌های آموزشی (apps/parent/learning.py) */
export interface LearningSummary {
  /** هفت روزِ اخیر */
  week: {
    minutes: number;
    prevMinutes: number;
    answers: number;
    errors: number;
    firstTry: FirstTry;
  };
  /** هشت هفته */
  firstTry: FirstTry;
  /** هشت هفته، پرخطاترین اول */
  concepts: ConceptStat[];
}

/** همه‌ی دیتای داشبوردِ یک بچه */
export interface ChildReport {
  childId: string;
  /** تعدادِ پاسخ‌های ثبت‌شده در هفت روز گذشته — پایه‌ی تحلیلِ هفتگی */
  answersThisWeek: number;
  /**
   * تحلیلِ آماده‌ی سرور. تا وقتی سرویسِ هوش مصنوعی وصل نشده خالی است و فرانت
   * خودش با `buildAnalysis` می‌سازد؛ به‌محضِ آمدنِ این فیلد، همان نشان داده می‌شود.
   */
  analysis?: ChildAnalysis;
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
  hourly: HourBucket[];
  sessions: PlaySession[];
  topics: TopicScore[];
  /** تگ‌های آموزشی؛ در گزارش‌های قدیمیِ کش‌شده نیست */
  learning?: LearningSummary;
}

/** پیشنهادِ بازی روز که سرور می‌سازد */
export interface Suggestion {
  slug: string;
  title: string;
  bookTitle: string;
  subject: string;
  topic: string;
  minutes: number;
  coinReward: number;
  /** جمله‌ای که به والد می‌گوید چرا این بازی پیشنهاد شده */
  why: string;
  recommended: boolean;
  played: boolean;
}

/** سوییچ‌های تبِ تنظیمات */
export interface ParentPreferences {
  weeklyReport: boolean;
  activityAlerts: boolean;
}

/** یک اعلان در شیتِ زنگوله */
export interface ParentNotification {
  id: number;
  kind: 'weekly' | 'games' | 'mood' | 'idle' | 'assignment' | 'billing' | 'announcement' | 'support';
  title: string;
  body: string;
  /** مسیرِ داخلِ پنل برای اقدام (مثلاً صورت‌حسابِ تمدید)؛ خالی یعنی فقط خبر */
  link?: string;
  isRead: boolean;
  childName: string;
  at: string;
}
