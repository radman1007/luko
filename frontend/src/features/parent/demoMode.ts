/**
 * ⚠️ موقتی — فقط برای تستِ ظاهرِ پنل والدین بدونِ حساب.
 *
 * با روشن‌بودنِ `GUEST_PARENT_PREVIEW`، کاربرِ مهمان می‌تواند `/parent-panel` را
 * ببیند و همه‌ی داده‌ها از همین فایلِ ساختگی می‌آید (هیچ درخواستی به سرور نمی‌رود).
 *
 * برای برگرداندن به حالتِ عادی، فقط این را `false` کنید؛ برای پاک‌کردنِ کامل:
 *   ۱) این فایل را حذف کنید
 *   ۲) شرطِ `isGuestParentPreview` را از `ProtectedRoute.tsx` و `api.ts` بردارید
 */
import { isGuestMode } from '@/features/auth/guest';
import type { Assignment, CatalogGame, Ticket } from './api';
import type {
  Child,
  ChildReport,
  ParentNotification,
  ParentPreferences,
  Suggestion,
} from './types';

/** 👈 برای برگشت به حالتِ عادی این را false کنید */
export const GUEST_PARENT_PREVIEW = true;

export function isGuestParentPreview(): boolean {
  return GUEST_PARENT_PREVIEW && isGuestMode();
}

const DEMO_CHILDREN: Child[] = [
  {
    id: 'demo-1',
    firstName: 'آرش',
    lastName: 'نمونه',
    phone: '09120000000',
    grade: 3,
    school: 'دبستان نمونه',
    lastActiveAt: 'امروز، ۱۸:۳۷',
    online: false,
  },
  {
    id: 'demo-2',
    firstName: 'نیکی',
    lastName: 'نمونه',
    phone: '09120000001',
    grade: 1,
    school: '',
    lastActiveAt: 'دیروز، ۱۷:۱۲',
    online: false,
  },
];

/** گزارشِ ساختگی — اعدادش با هم سازگارند تا تحلیل، حرفِ بی‌ربط نزند */
function demoReport(childId: string): ChildReport {
  const strong = childId === 'demo-1';

  return {
    childId,
    answersThisWeek: strong ? 326 : 148,
    kpis: [
      { key: 'time', label: 'زمان یادگیری این هفته', value: strong ? 68 : 45, unit: 'دقیقه',
        delta: strong ? -12 : 20, higherIsBetter: true },
      { key: 'games', label: 'بازی کامل‌شده', value: strong ? 3 : 6, unit: 'بازی',
        delta: strong ? 0 : 20, higherIsBetter: true },
      { key: 'accuracy', label: 'میانگین دقت پاسخ‌ها', value: strong ? 83 : 74, unit: '٪',
        delta: strong ? 3 : -4, higherIsBetter: true },
      { key: 'streak', label: 'روزهای پیاپی', value: strong ? 4 : 2, unit: 'روز',
        delta: 0, higherIsBetter: true },
      { key: 'session', label: 'میانگین هر جلسه', value: strong ? 8 : 7, unit: 'دقیقه',
        delta: 0, higherIsBetter: true },
      { key: 'coins', label: 'سکهٔ این هفته', value: strong ? 36 : 140, unit: 'سکه',
        delta: strong ? -12 : 35, higherIsBetter: true },
    ],
    week: [
      { day: 'شنبه', minutes: strong ? 5 : 12, games: 1 },
      { day: 'یک‌شنبه', minutes: strong ? 0 : 18, games: 0 },
      { day: 'دوشنبه', minutes: strong ? 23 : 0, games: 1 },
      { day: 'سه‌شنبه', minutes: strong ? 5 : 22, games: 1 },
      { day: 'چهارشنبه', minutes: 0, games: 0 },
      { day: 'پنج‌شنبه', minutes: strong ? 34 : 9, games: 1 },
      { day: 'جمعه', minutes: strong ? 1 : 0, games: 0 },
    ],
    accuracyTrend: [
      { label: 'هفتهٔ ۱', value: 0, samples: 0 },
      { label: 'هفتهٔ ۲', value: 0, samples: 0 },
      { label: 'هفتهٔ ۳', value: 55, samples: 75 },
      { label: 'هفتهٔ ۴', value: 64, samples: 51 },
      { label: 'هفتهٔ ۵', value: 72, samples: 28 },
      { label: 'هفتهٔ ۶', value: 78, samples: 77 },
      { label: 'هفتهٔ ۷', value: 76, samples: 43 },
      { label: 'هفتهٔ ۸', value: strong ? 83 : 74, samples: 52 },
    ],
    subjects: [
      { key: 'math', label: 'ریاضی', mastery: strong ? 74 : 68, gamesDone: strong ? 8 : 5,
        gamesTotal: 10, trend: 'up', weakestTopic: 'الگو' },
      { key: 'writing', label: 'نگارش', mastery: 0, gamesDone: 0, gamesTotal: 4, trend: 'flat' },
      { key: 'science', label: 'علوم', mastery: 0, gamesDone: 0, gamesTotal: 3, trend: 'flat' },
      { key: 'quran', label: 'قرآن', mastery: 0, gamesDone: 0, gamesTotal: 1, trend: 'flat' },
    ],
    games: [
      { id: 'g1', title: 'جزیره‌ی حیوانات', subject: 'math', subjectLabel: 'ریاضی',
        book: 'ریاضی اول', attempts: 8, bestScore: 100, accuracy: 73, avgSeconds: 529,
        totalMinutes: 71, hints: 4, lastPlayedAt: '۲۳ مرداد', coins: 10, status: 'progress' },
      { id: 'g2', title: 'آشپز کوچولو', subject: 'math', subjectLabel: 'ریاضی',
        book: 'ریاضی اول', attempts: 6, bestScore: 83, accuracy: 58, avgSeconds: 655,
        totalMinutes: 66, hints: 0, lastPlayedAt: '۱۱ مرداد', coins: 12, status: 'struggling' },
      { id: 'g3', title: 'هیولاهای گرسنه', subject: 'math', subjectLabel: 'ریاضی',
        book: 'ریاضی اول', attempts: 7, bestScore: 88, accuracy: 71, avgSeconds: 533,
        totalMinutes: 62, hints: 3, lastPlayedAt: '۲۰ مرداد', coins: 12, status: 'progress' },
      { id: 'g4', title: 'خرگوش مهربان', subject: 'math', subjectLabel: 'ریاضی',
        book: 'ریاضی اول', attempts: 9, bestScore: 100, accuracy: 88, avgSeconds: 543,
        totalMinutes: 81, hints: 3, lastPlayedAt: '۲۴ مرداد', coins: 14, status: 'mastered' },
    ],
    moods: [
      { day: '۱۱', mood: 'sad' }, { day: '۱۲', mood: 'calm' }, { day: '۱۳', mood: 'tired' },
      { day: '۱۴', mood: 'happy' }, { day: '۱۵', mood: 'happy' }, { day: '۱۶', mood: 'calm' },
      { day: '۱۷', mood: 'tired' }, { day: '۱۸', mood: 'calm' }, { day: '۱۹', mood: 'happy' },
      { day: '۲۰', mood: 'happy' }, { day: '۲۱', mood: 'calm' }, { day: '۲۲', mood: 'calm' },
      { day: '۲۳', mood: 'tired' }, { day: '۲۴', mood: 'happy' },
    ],
    insights: [],
    wellbeing: {
      checkins: strong ? 9 : 12,
      breathingSessions: strong ? 9 : 5,
      paintings: strong ? 6 : 3,
      dominantMood: strong ? 'tired' : 'happy',
    },
    hourly: Array.from({ length: 24 }, (_, hour) => {
      const counts: Record<number, number> = strong
        ? { 7: 2, 8: 4, 18: 6, 19: 8, 20: 5, 21: 6, 22: 7 }
        : { 7: 1, 8: 3, 12: 2, 13: 4, 14: 5, 15: 3, 16: 1, 18: 2, 19: 1 };
      const count = counts[hour] ?? 0;
      return { hour, count, intensity: Math.round((count / 8) * 100) };
    }),
    sessions: [
      { id: 1, game: 'خرگوش مهربان', at: 'دیروز', time: '۱۹:۰۳', minutes: 5, accuracy: 100 },
      { id: 2, game: 'جزیره‌ی حیوانات', at: '۲۳ مرداد', time: '۱۸:۳۷', minutes: 12, accuracy: 71 },
      { id: 3, game: 'سفر ریتم', at: '۲۳ مرداد', time: '۱۷:۳۷', minutes: 13, accuracy: 100 },
      { id: 4, game: 'سفر ریتم', at: '۲۳ مرداد', time: '۱۶:۴۴', minutes: 9, accuracy: 67 },
      { id: 5, game: 'هیولاهای گرسنه', at: '۲۰ مرداد', time: '۱۷:۲۵', minutes: 5, accuracy: 86 },
      { id: 6, game: 'هیولاهای گرسنه', at: '۱۹ مرداد', time: '۱۸:۲۴', minutes: 6, accuracy: 80 },
      { id: 7, game: 'مقایسهٔ میوه‌ها', at: '۱۸ مرداد', time: '۱۷:۱۰', minutes: 7, accuracy: 79 },
      { id: 8, game: 'ترتیب اعداد', at: '۱۷ مرداد', time: '۱۶:۰۲', minutes: 6, accuracy: 76 },
    ],
    topics: [
      { key: 'compare', label: 'مقایسه', asked: 73, accuracy: 79, avgSeconds: 7 },
      { key: 'sort', label: 'ترتیب اعداد', asked: 75, accuracy: 76, avgSeconds: 7 },
      { key: 'count', label: 'شمارش', asked: 66, accuracy: 74, avgSeconds: 7 },
      { key: 'missing', label: 'دنبالهٔ اعداد', asked: 52, accuracy: 69, avgSeconds: 8 },
      { key: 'pattern', label: 'الگو', asked: 60, accuracy: 67, avgSeconds: 7 },
    ],
  };
}

const DEMO_SUGGESTIONS: Suggestion[] = [
  { slug: 'demo-a', title: 'الگویاب', bookTitle: 'ریاضی اول', subject: 'ریاضی', topic: 'الگو',
    minutes: 7, coinReward: 12, recommended: true, played: false,
    why: 'دقتش در این بازی ۶۷٪ بوده؛ جای پیشرفت دارد — و مبحثِ «الگو» را تمرین می‌دهد' },
  { slug: 'demo-b', title: 'دنبالهٔ اعداد', bookTitle: 'ریاضی اول', subject: 'ریاضی',
    topic: 'دنبالهٔ اعداد', minutes: 8, coinReward: 12, recommended: false, played: false,
    why: 'هنوز این بازی را انجام نداده است' },
  { slug: 'demo-c', title: 'مقایسهٔ میوه‌ها', bookTitle: 'ریاضی اول', subject: 'ریاضی',
    topic: 'مقایسه', minutes: 6, coinReward: 10, recommended: false, played: true,
    why: 'دقتش در این بازی ۷۹٪ است؛ مرورِ خوبی می‌شود' },
  { slug: 'demo-d', title: 'برج شمارش', bookTitle: 'ریاضی اول', subject: 'ریاضی', topic: 'شمارش',
    minutes: 6, coinReward: 10, recommended: false, played: true,
    why: 'مرورِ چیزی که قبلاً کار کرده است' },
];

const DEMO_NOTIFICATIONS: ParentNotification[] = [
  { id: 1, kind: 'weekly', title: 'گزارش هفتگی آرش آماده شد',
    body: 'خلاصهٔ این هفته را در داشبورد ببینید.', isRead: false, childName: 'آرش',
    at: 'امروز، ۰۹:۱۲' },
  { id: 2, kind: 'games', title: 'آرش «خرگوش مهربان» را کامل کرد',
    body: 'جزئیاتِ دقت و زمانش در تبِ گزارش‌ها هست.', isRead: false, childName: 'آرش',
    at: 'دیروز، ۱۹:۰۳' },
  { id: 3, kind: 'mood', title: 'ثبت حال نیکی: خوشحال',
    body: 'روند حال و روحیه را در تبِ سلامت ببینید.', isRead: true, childName: 'نیکی',
    at: 'دیروز، ۱۷:۳۰' },
];

/** همان امضای `parentApi` ولی بدونِ شبکه */
export const demoParentApi = {
  children: async (): Promise<Child[]> => DEMO_CHILDREN,
  report: async (childId: string): Promise<ChildReport> => demoReport(childId),
  suggestions: async (): Promise<{ date: string; currentSlug: string | null; suggestions: Suggestion[] }> => ({
    date: new Date().toISOString().slice(0, 10),
    currentSlug: null,
    suggestions: DEMO_SUGGESTIONS,
  }),
  assignments: async (): Promise<Assignment[]> => [],
  preferences: async (): Promise<ParentPreferences> => ({
    weeklyReport: true,
    activityAlerts: true,
  }),
  notifications: async (): Promise<{ items: ParentNotification[]; unread: number }> => ({
    items: DEMO_NOTIFICATIONS,
    unread: DEMO_NOTIFICATIONS.filter((row) => !row.isRead).length,
  }),
  tickets: async (): Promise<Ticket[]> => [],
  catalog: async (): Promise<CatalogGame[]> => [],
};
