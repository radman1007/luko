/**
 * دادهٔ نمونهٔ پنل والدین — فقط برای ساختِ ظاهر.
 * TODO: با آمدنِ بک‌اند جای این فایل را `GET /parent/children` و
 * `GET /parent/children/{id}/report` می‌گیرد (نگاه: docs/backend-integration.md).
 */
import type { Child, ChildReport } from './types';

export const MOCK_CHILDREN: Child[] = [
  {
    id: 'c1',
    firstName: 'آرش',
    lastName: 'رستمی',
    grade: 3,
    school: 'دبستان شهید مطهری',
    lastActiveAt: 'امروز، ۱۷:۲۰',
    online: true,
  },
  {
    id: 'c2',
    firstName: 'نیکی',
    lastName: 'رستمی',
    grade: 1,
    school: 'دبستان شهید مطهری',
    lastActiveAt: 'دیروز، ۱۹:۰۵',
  },
];

const REPORT_C1: ChildReport = {
  childId: 'c1',
  kpis: [
    { key: 'time', label: 'زمان یادگیری این هفته', value: 245, unit: 'دقیقه', delta: 12, higherIsBetter: true, hint: 'مجموع زمان حضور فعال در بازی‌ها و بخش‌های آموزشی' },
    { key: 'games', label: 'بازی کامل‌شده', value: 18, unit: 'بازی', delta: 20, higherIsBetter: true },
    { key: 'accuracy', label: 'میانگین دقت پاسخ‌ها', value: 84, unit: '٪', delta: 5, higherIsBetter: true },
    { key: 'streak', label: 'روزهای پیاپی', value: 6, unit: 'روز', delta: 0, higherIsBetter: true },
    { key: 'session', label: 'میانگین هر جلسه', value: 14, unit: 'دقیقه', delta: -8, higherIsBetter: true, hint: 'جلسه‌های کوتاه‌تر می‌تواند نشانهٔ خستگی یا حواس‌پرتی باشد' },
    { key: 'coins', label: 'سکهٔ این هفته', value: 320, unit: 'سکه', delta: 15, higherIsBetter: true },
  ],
  week: [
    { day: 'شنبه', minutes: 42, games: 3 },
    { day: 'یک‌شنبه', minutes: 28, games: 2 },
    { day: 'دوشنبه', minutes: 51, games: 4 },
    { day: 'سه‌شنبه', minutes: 12, games: 1 },
    { day: 'چهارشنبه', minutes: 46, games: 3 },
    { day: 'پنج‌شنبه', minutes: 38, games: 3 },
    { day: 'جمعه', minutes: 28, games: 2 },
  ],
  accuracyTrend: [
    { label: 'هفتهٔ ۱', value: 62 },
    { label: 'هفتهٔ ۲', value: 68 },
    { label: 'هفتهٔ ۳', value: 65 },
    { label: 'هفتهٔ ۴', value: 71 },
    { label: 'هفتهٔ ۵', value: 76 },
    { label: 'هفتهٔ ۶', value: 74 },
    { label: 'هفتهٔ ۷', value: 79 },
    { label: 'هفتهٔ ۸', value: 84 },
  ],
  subjects: [
    { key: 'math', label: 'ریاضی', mastery: 86, gamesDone: 14, gamesTotal: 18, trend: 'up' },
    { key: 'science', label: 'علوم', mastery: 72, gamesDone: 9, gamesTotal: 15, trend: 'up' },
    { key: 'writing', label: 'فارسی و نگارش', mastery: 58, gamesDone: 7, gamesTotal: 16, trend: 'flat' },
    { key: 'quran', label: 'قرآن', mastery: 41, gamesDone: 4, gamesTotal: 12, trend: 'down' },
    { key: 'life', label: 'مهارت‌های زندگی', mastery: 64, gamesDone: 6, gamesTotal: 10, trend: 'up' },
  ],
  games: [
    { id: 'g1', title: 'جزیرهٔ حیوانات', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی پایهٔ سوم', attempts: 7, bestScore: 96, accuracy: 91, avgSeconds: 184, totalMinutes: 21, hints: 2, lastPlayedAt: 'امروز', coins: 45, status: 'mastered' },
    { id: 'g2', title: 'جمع و تفریق سریع', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی پایهٔ سوم', attempts: 5, bestScore: 88, accuracy: 83, avgSeconds: 142, totalMinutes: 12, hints: 4, lastPlayedAt: 'دیروز', coins: 30, status: 'progress' },
    { id: 'g3', title: 'ضرب‌های دوست‌داشتنی', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی پایهٔ سوم', attempts: 9, bestScore: 61, accuracy: 54, avgSeconds: 268, totalMinutes: 34, hints: 11, lastPlayedAt: '۲ روز پیش', coins: 18, status: 'struggling' },
    { id: 'g4', title: 'چرخهٔ آب', subject: 'science', subjectLabel: 'علوم', book: 'علوم پایهٔ سوم', attempts: 4, bestScore: 92, accuracy: 88, avgSeconds: 205, totalMinutes: 15, hints: 1, lastPlayedAt: 'دیروز', coins: 36, status: 'mastered' },
    { id: 'g5', title: 'جانوران و زیستگاه', subject: 'science', subjectLabel: 'علوم', book: 'علوم پایهٔ سوم', attempts: 3, bestScore: 74, accuracy: 70, avgSeconds: 231, totalMinutes: 12, hints: 5, lastPlayedAt: '۳ روز پیش', coins: 22, status: 'progress' },
    { id: 'g6', title: 'کلمه‌سازی', subject: 'writing', subjectLabel: 'فارسی و نگارش', book: 'نگارش پایهٔ سوم', attempts: 6, bestScore: 70, accuracy: 66, avgSeconds: 178, totalMinutes: 18, hints: 7, lastPlayedAt: '۴ روز پیش', coins: 24, status: 'progress' },
    { id: 'g7', title: 'نشانه‌ها و صداها', subject: 'writing', subjectLabel: 'فارسی و نگارش', book: 'نگارش پایهٔ سوم', attempts: 8, bestScore: 58, accuracy: 49, avgSeconds: 294, totalMinutes: 39, hints: 14, lastPlayedAt: 'امروز', coins: 15, status: 'struggling' },
    { id: 'g8', title: 'سوره‌های کوتاه', subject: 'quran', subjectLabel: 'قرآن', book: 'قرآن پایهٔ سوم', attempts: 2, bestScore: 80, accuracy: 76, avgSeconds: 160, totalMinutes: 6, hints: 2, lastPlayedAt: 'هفتهٔ پیش', coins: 12, status: 'progress' },
    { id: 'g9', title: 'قانون‌های جاده', subject: 'life', subjectLabel: 'مهارت‌های زندگی', book: 'قانون روز', attempts: 5, bestScore: 94, accuracy: 90, avgSeconds: 121, totalMinutes: 10, hints: 0, lastPlayedAt: 'دیروز', coins: 28, status: 'mastered' },
    { id: 'g10', title: 'آشپزی با زعفران', subject: 'life', subjectLabel: 'مهارت‌های زندگی', book: 'آشپزی روز', attempts: 0, bestScore: 0, accuracy: 0, avgSeconds: 0, totalMinutes: 0, hints: 0, lastPlayedAt: '—', coins: 0, status: 'untouched' },
  ],
  moods: [
    { day: '۱', mood: 'happy' }, { day: '۲', mood: 'calm' }, { day: '۳', mood: 'happy' },
    { day: '۴', mood: 'tired' }, { day: '۵', mood: 'happy' }, { day: '۶', mood: 'calm' },
    { day: '۷', mood: 'sad' }, { day: '۸', mood: 'calm' }, { day: '۹', mood: 'happy' },
    { day: '۱۰', mood: 'happy' }, { day: '۱۱', mood: 'tired' }, { day: '۱۲', mood: 'calm' },
    { day: '۱۳', mood: 'happy' }, { day: '۱۴', mood: 'happy' },
  ],
  insights: [
    {
      id: 'i1',
      tone: 'good',
      title: 'ریاضی رو محکم گرفته',
      body: 'دقت آرش در بازی‌های ریاضی طی ۸ هفته از ۶۲٪ به ۸۴٪ رسیده و در «جزیرهٔ حیوانات» بدون راهنمایی امتیاز کامل گرفته است.',
    },
    {
      id: 'i2',
      tone: 'watch',
      title: 'نشانه‌ها و صداها نقطهٔ گیر است',
      body: 'در این بازی ۸ بار تلاش کرده، ۱۴ بار راهنمایی گرفته و میانگین هر دور ۴ دقیقه و ۵۴ ثانیه طول کشیده — بیشتر از دو برابر بقیهٔ بازی‌ها.',
    },
    {
      id: 'i3',
      tone: 'tip',
      title: 'سه‌شنبه‌ها افت دارد',
      body: 'فعالیت سه‌شنبه ۱۲ دقیقه بوده در حالی که میانگین هفته ۳۵ دقیقه است. یک جلسهٔ کوتاه ۱۰ دقیقه‌ای در این روز، استریک را حفظ می‌کند.',
    },
  ],
  wellbeing: { checkins: 11, breathingSessions: 4, paintings: 3, dominantMood: 'happy' },
};

const REPORT_C2: ChildReport = {
  childId: 'c2',
  kpis: [
    { key: 'time', label: 'زمان یادگیری این هفته', value: 132, unit: 'دقیقه', delta: -6, higherIsBetter: true },
    { key: 'games', label: 'بازی کامل‌شده', value: 9, unit: 'بازی', delta: 12, higherIsBetter: true },
    { key: 'accuracy', label: 'میانگین دقت پاسخ‌ها', value: 76, unit: '٪', delta: 9, higherIsBetter: true },
    { key: 'streak', label: 'روزهای پیاپی', value: 3, unit: 'روز', delta: -2, higherIsBetter: true },
    { key: 'session', label: 'میانگین هر جلسه', value: 11, unit: 'دقیقه', delta: 4, higherIsBetter: true },
    { key: 'coins', label: 'سکهٔ این هفته', value: 180, unit: 'سکه', delta: 8, higherIsBetter: true },
  ],
  week: [
    { day: 'شنبه', minutes: 24, games: 2 },
    { day: 'یک‌شنبه', minutes: 18, games: 1 },
    { day: 'دوشنبه', minutes: 31, games: 2 },
    { day: 'سه‌شنبه', minutes: 0, games: 0 },
    { day: 'چهارشنبه', minutes: 22, games: 2 },
    { day: 'پنج‌شنبه', minutes: 20, games: 1 },
    { day: 'جمعه', minutes: 17, games: 1 },
  ],
  accuracyTrend: [
    { label: 'هفتهٔ ۱', value: 51 },
    { label: 'هفتهٔ ۲', value: 55 },
    { label: 'هفتهٔ ۳', value: 60 },
    { label: 'هفتهٔ ۴', value: 58 },
    { label: 'هفتهٔ ۵', value: 66 },
    { label: 'هفتهٔ ۶', value: 70 },
    { label: 'هفتهٔ ۷', value: 72 },
    { label: 'هفتهٔ ۸', value: 76 },
  ],
  subjects: [
    { key: 'math', label: 'ریاضی', mastery: 68, gamesDone: 6, gamesTotal: 12, trend: 'up' },
    { key: 'writing', label: 'فارسی و نگارش', mastery: 74, gamesDone: 7, gamesTotal: 12, trend: 'up' },
    { key: 'science', label: 'علوم', mastery: 45, gamesDone: 3, gamesTotal: 10, trend: 'flat' },
    { key: 'quran', label: 'قرآن', mastery: 52, gamesDone: 3, gamesTotal: 8, trend: 'up' },
    { key: 'life', label: 'مهارت‌های زندگی', mastery: 38, gamesDone: 2, gamesTotal: 8, trend: 'down' },
  ],
  games: [
    { id: 'h1', title: 'شمارش تا ۲۰', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی پایهٔ اول', attempts: 6, bestScore: 90, accuracy: 85, avgSeconds: 132, totalMinutes: 13, hints: 3, lastPlayedAt: 'دیروز', coins: 32, status: 'mastered' },
    { id: 'h2', title: 'الگوهای رنگی', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی پایهٔ اول', attempts: 4, bestScore: 72, accuracy: 64, avgSeconds: 176, totalMinutes: 12, hints: 6, lastPlayedAt: '۲ روز پیش', coins: 20, status: 'progress' },
    { id: 'h3', title: 'نشانهٔ آ', subject: 'writing', subjectLabel: 'فارسی و نگارش', book: 'نگارش پایهٔ اول', attempts: 5, bestScore: 88, accuracy: 81, avgSeconds: 121, totalMinutes: 10, hints: 2, lastPlayedAt: 'دیروز', coins: 26, status: 'mastered' },
    { id: 'h4', title: 'حیوانات مزرعه', subject: 'science', subjectLabel: 'علوم', book: 'علوم پایهٔ اول', attempts: 3, bestScore: 55, accuracy: 47, avgSeconds: 248, totalMinutes: 12, hints: 9, lastPlayedAt: '۵ روز پیش', coins: 10, status: 'struggling' },
    { id: 'h5', title: 'سورهٔ کوثر', subject: 'quran', subjectLabel: 'قرآن', book: 'قرآن پایهٔ اول', attempts: 2, bestScore: 78, accuracy: 74, avgSeconds: 150, totalMinutes: 5, hints: 1, lastPlayedAt: 'هفتهٔ پیش', coins: 12, status: 'progress' },
    { id: 'h6', title: 'قانون‌های جاده', subject: 'life', subjectLabel: 'مهارت‌های زندگی', book: 'قانون روز', attempts: 0, bestScore: 0, accuracy: 0, avgSeconds: 0, totalMinutes: 0, hints: 0, lastPlayedAt: '—', coins: 0, status: 'untouched' },
  ],
  moods: [
    { day: '۱', mood: 'calm' }, { day: '۲', mood: 'happy' }, { day: '۳', mood: 'tired' },
    { day: '۴', mood: 'calm' }, { day: '۵', mood: 'happy' }, { day: '۶', mood: 'happy' },
    { day: '۷', mood: 'calm' }, { day: '۸', mood: 'angry' }, { day: '۹', mood: 'tired' },
    { day: '۱۰', mood: 'calm' }, { day: '۱۱', mood: 'happy' }, { day: '۱۲', mood: 'happy' },
    { day: '۱۳', mood: 'calm' }, { day: '۱۴', mood: 'happy' },
  ],
  insights: [
    {
      id: 'i1',
      tone: 'good',
      title: 'نگارش با سرعت خوبی جلو می‌رود',
      body: 'نیکی در بازی «نشانهٔ آ» فقط با ۲ راهنمایی به امتیاز ۸۸ رسیده و دقتش در ۴ هفتهٔ اخیر ۱۸ واحد بالا رفته است.',
    },
    {
      id: 'i2',
      tone: 'watch',
      title: 'علوم عقب مانده',
      body: 'از ۱۰ بازی علوم فقط ۳ تا انجام شده و در «حیوانات مزرعه» ۹ بار راهنمایی گرفته است.',
    },
    {
      id: 'i3',
      tone: 'tip',
      title: 'جلسه‌ها کوتاه ولی منظم‌اند',
      body: 'میانگین هر جلسه ۱۱ دقیقه است؛ برای این سن مناسب است، فقط سه‌شنبه‌ها کاملاً خالی مانده.',
    },
  ],
  wellbeing: { checkins: 8, breathingSessions: 2, paintings: 5, dominantMood: 'calm' },
};

const REPORTS: Record<string, ChildReport> = { c1: REPORT_C1, c2: REPORT_C2 };

export function mockReport(childId: string): ChildReport {
  return REPORTS[childId] ?? REPORT_C1;
}
