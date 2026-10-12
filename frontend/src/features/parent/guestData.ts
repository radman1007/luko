import type { Assignment } from './api';
import type { Child, ChildReport, ParentPreferences, Suggestion } from './types';

const today = new Date();
const isoDate = (offset: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const GUEST_CHILDREN: Child[] = [
  {
    id: 'guest-child-1',
    firstName: 'آرش',
    lastName: 'رستمی',
    grade: 3,
    school: 'مدرسهٔ لوکو',
    lastActiveAt: 'امروز، ۱۵:۳۰',
    online: true,
  },
  {
    id: 'guest-child-2',
    firstName: 'نیکی',
    lastName: '',
    grade: 1,
    school: 'مدرسهٔ لوکو',
    lastActiveAt: 'دیروز، ۱۸:۱۰',
    online: false,
  },
];

const reportFor = (strong: boolean): ChildReport => ({
  childId: strong ? 'guest-child-1' : 'guest-child-2',
  answersThisWeek: strong ? 12 : 8,
  kpis: [
    { key: 'time', label: 'زمان یادگیری این هفته', value: strong ? 45 : 28, unit: 'دقیقه', delta: strong ? 20 : -12, higherIsBetter: true },
    { key: 'games', label: 'بازی کامل‌شده', value: strong ? 6 : 3, unit: 'بازی', delta: strong ? 50 : 0, higherIsBetter: true },
    { key: 'accuracy', label: 'میانگین دقت پاسخ‌ها', value: strong ? 74 : 61, unit: '٪', delta: strong ? 8 : -6, higherIsBetter: true },
    { key: 'streak', label: 'روزهای پیاپی', value: strong ? 3 : 1, unit: 'روز', delta: 0, higherIsBetter: true },
    { key: 'session', label: 'میانگین هر جلسه', value: strong ? 8 : 6, unit: 'دقیقه', delta: 0, higherIsBetter: true },
    { key: 'coins', label: 'سکهٔ این هفته', value: strong ? 86 : 39, unit: 'سکه', delta: strong ? 18 : 0, higherIsBetter: true },
  ],
  week: strong
    ? [
        { day: 'شنبه', minutes: 5, games: 1 }, { day: 'یک‌شنبه', minutes: 0, games: 0 },
        { day: 'دوشنبه', minutes: 12, games: 2 }, { day: 'سه‌شنبه', minutes: 8, games: 1 },
        { day: 'چهارشنبه', minutes: 0, games: 0 }, { day: 'پنج‌شنبه', minutes: 13, games: 2 },
        { day: 'جمعه', minutes: 7, games: 1 },
      ]
    : [
        { day: 'شنبه', minutes: 0, games: 0 }, { day: 'یک‌شنبه', minutes: 6, games: 1 },
        { day: 'دوشنبه', minutes: 0, games: 0 }, { day: 'سه‌شنبه', minutes: 0, games: 0 },
        { day: 'چهارشنبه', minutes: 9, games: 1 }, { day: 'پنج‌شنبه', minutes: 0, games: 0 },
        { day: 'جمعه', minutes: 13, games: 1 },
      ],
  accuracyTrend: [
    { label: 'هفتهٔ ۱', value: 58, samples: 8 }, { label: 'هفتهٔ ۲', value: 64, samples: 10 },
    { label: 'هفتهٔ ۳', value: 61, samples: 7 }, { label: 'هفتهٔ ۴', value: 69, samples: 11 },
    { label: 'هفتهٔ ۵', value: 66, samples: 9 }, { label: 'هفتهٔ ۶', value: strong ? 71 : 55, samples: 8 },
    { label: 'هفتهٔ ۷', value: strong ? 68 : 60, samples: 9 }, { label: 'هفتهٔ ۸', value: strong ? 74 : 61, samples: strong ? 12 : 8 },
  ],
  subjects: [
    { key: 'math', label: 'ریاضی', mastery: strong ? 74 : 61, gamesDone: strong ? 6 : 3, gamesTotal: 12, trend: strong ? 'up' : 'flat', weakestTopic: 'الگو' },
    { key: 'science', label: 'علوم', mastery: 0, gamesDone: 0, gamesTotal: 8, trend: 'flat' },
    { key: 'writing', label: 'نگارش', mastery: 0, gamesDone: 0, gamesTotal: 7, trend: 'flat' },
  ],
  games: [
    { id: 'guest-game-1', title: 'جزیرهٔ حیوانات', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی اول', attempts: strong ? 8 : 4, bestScore: strong ? 92 : 78, accuracy: strong ? 73 : 58, avgSeconds: 529, totalMinutes: strong ? 18 : 9, hints: 2, lastPlayedAt: 'امروز، ۱۵:۳۰', coins: 34, status: strong ? 'progress' : 'struggling' },
    { id: 'guest-game-2', title: 'الگویاب', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی اول', attempts: strong ? 6 : 3, bestScore: strong ? 88 : 71, accuracy: strong ? 67 : 54, avgSeconds: 411, totalMinutes: strong ? 14 : 8, hints: 3, lastPlayedAt: '۲۴ مرداد', coins: 22, status: 'struggling' },
    { id: 'guest-game-3', title: 'سفر ریتم', subject: 'math', subjectLabel: 'ریاضی', book: 'ریاضی اول', attempts: 5, bestScore: 96, accuracy: strong ? 86 : 72, avgSeconds: 318, totalMinutes: strong ? 13 : 7, hints: 0, lastPlayedAt: '۲۳ مرداد', coins: 30, status: strong ? 'mastered' : 'progress' },
  ],
  moods: [
    { day: 'شنبه', mood: 'calm' }, { day: 'یک‌شنبه', mood: 'happy' }, { day: 'دوشنبه', mood: 'happy' },
    { day: 'سه‌شنبه', mood: 'tired' }, { day: 'چهارشنبه', mood: 'calm' }, { day: 'پنج‌شنبه', mood: 'happy' },
    { day: 'جمعه', mood: 'calm' },
  ],
  insights: [
    { id: 'guest-good', tone: 'good', title: 'مقایسه را خوب گرفته', body: 'در بیشترِ سؤال‌های مقایسه پاسخ درست داده است.' },
    { id: 'guest-watch', tone: 'watch', title: 'الگو نقطهٔ گیر است', body: 'چند بازیِ کوتاه در این مبحث می‌تواند کمک‌کننده باشد.' },
  ],
  wellbeing: { checkins: strong ? 9 : 5, breathingSessions: strong ? 4 : 2, paintings: strong ? 3 : 1, dominantMood: strong ? 'happy' : 'calm' },
  hourly: [
    { hour: 9, count: 2, intensity: 35 }, { hour: 11, count: 3, intensity: 52 },
    { hour: 15, count: strong ? 6 : 3, intensity: strong ? 100 : 58 }, { hour: 17, count: 4, intensity: 70 },
    { hour: 19, count: 2, intensity: 35 },
  ],
  sessions: [
    { id: 1, game: 'جزیرهٔ حیوانات', at: 'امروز', time: '۱۵:۳۰', minutes: 7, accuracy: strong ? 86 : 70, stars: 3 },
    { id: 2, game: 'الگویاب', at: '۲۴ مرداد', time: '۱۹:۰۳', minutes: 5, accuracy: strong ? 67 : 54, stars: 2 },
    { id: 3, game: 'سفر ریتم', at: '۲۳ مرداد', time: '۱۷:۳۷', minutes: 13, accuracy: strong ? 100 : 76, stars: 3 },
    { id: 4, game: 'جزیرهٔ حیوانات', at: '۲۰ مرداد', time: '۱۷:۲۵', minutes: 9, accuracy: strong ? 78 : 63, stars: 2 },
  ],
  topics: [
    { key: 'compare', label: 'مقایسه', asked: strong ? 8 : 5, accuracy: strong ? 88 : 72, avgSeconds: 18 },
    { key: 'pattern', label: 'الگو', asked: strong ? 7 : 6, accuracy: strong ? 67 : 54, avgSeconds: 24 },
    { key: 'count', label: 'شمارش', asked: 6, accuracy: strong ? 83 : 69, avgSeconds: 16 },
  ],
  learning: {
    week: {
      minutes: strong ? 45 : 28,
      prevMinutes: strong ? 37 : 32,
      answers: strong ? 21 : 17,
      errors: strong ? 5 : 7,
      firstTry: strong ? { asked: 14, correct: 11, rate: 79 } : { asked: 12, correct: 7, rate: 58 },
    },
    firstTry: strong ? { asked: 52, correct: 40, rate: 77 } : { asked: 41, correct: 25, rate: 61 },
    concepts: [
      {
        tag: 'pattern', label: 'الگو', subject: 'math', answers: strong ? 7 : 6, errors: strong ? 2 : 3,
        accuracy: strong ? 71 : 50, firstTryAsked: 5, firstTryRate: strong ? 60 : 40, avgSeconds: 24, hints: 2,
        errorTypes: [{ key: 'conceptual', label: 'مفهومی', count: 2 }],
      },
      {
        tag: 'count', label: 'شمارش', subject: 'math', answers: 6, errors: strong ? 1 : 2,
        accuracy: strong ? 83 : 67, firstTryAsked: 5, firstTryRate: strong ? 80 : 60, avgSeconds: 16, hints: 0,
        errorTypes: [{ key: 'careless', label: 'بی‌دقتی', count: 1 }],
      },
      {
        tag: 'compare', label: 'مقایسه', subject: 'math', answers: strong ? 8 : 5, errors: strong ? 1 : 2,
        accuracy: strong ? 88 : 60, firstTryAsked: 6, firstTryRate: strong ? 83 : 67, avgSeconds: 18, hints: 0,
        errorTypes: [],
      },
    ],
  },
});

export const GUEST_REPORTS: Record<string, ChildReport> = {
  'guest-child-1': reportFor(true),
  'guest-child-2': reportFor(false),
};

const suggestion = (slug: string, title: string, topic: string, minutes: number, coinReward: number, played: boolean): Suggestion => ({
  slug, title, topic, minutes, coinReward, played, recommended: slug === 'pattern-practice',
  bookTitle: 'ریاضی اول', subject: 'ریاضی',
  why: `این بازی حدود ${minutes.toLocaleString('fa-IR')} دقیقه زمان می‌برد و برای تمرینِ «${topic}» پیشنهاد شده است.`,
});

export const GUEST_SUGGESTIONS: Suggestion[] = [
  suggestion('pattern-practice', 'الگویاب', 'الگو', 7, 12, true),
  suggestion('animal-island', 'جزیرهٔ حیوانات', 'مقایسه', 8, 15, false),
  suggestion('number-train', 'قطار اعداد', 'شمارش', 6, 10, true),
];

export const GUEST_ASSIGNMENTS: Record<string, Assignment[]> = {
  'guest-child-1': [{ id: 1, gameSlug: 'pattern-practice', gameTitle: 'الگویاب', bookTitle: 'ریاضی اول', date: isoDate(0), note: '', played: false }],
  'guest-child-2': [],
};

export const GUEST_PREFERENCES: ParentPreferences = { weeklyReport: true, activityAlerts: true };
