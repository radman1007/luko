// TODO: بعد از آماده شدن بک‌اند، کتاب‌ها و مراحل و پیشرفت از API می‌آیند (bookService)
import type { IconType } from 'react-icons';
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineCalculator,
  HiOutlinePencil,
} from 'react-icons/hi2';

export interface GameLevel {
  id: string;
  order: number;
  title: string;
  coinReward: number;
  /**
   * مسیر فایلِ بازی در public (نسبت به ریشه). اگر خالی باشد یعنی بازیِ این مرحله
   * هنوز ساخته نشده و در صفحه‌ی اجرا «به‌زودی» نمایش داده می‌شود.
   * TODO: بعد از بک‌اند، این آدرس از bookService می‌آید.
   */
  gameFile?: string;
}

export interface BookWorld {
  id: string;
  title: string;
  subject: string;
  /** نام دنیای بازی */
  worldTitle: string;
  icon: IconType;
  levels: GameLevel[];
}

interface LevelSeed {
  title: string;
  coinReward: number;
  /** نام فایلِ بازی داخل پوشه‌ی همان درس؛ نبودنش یعنی «به‌زودی» */
  file?: string;
}

/** ساخت مراحلِ یک کتاب؛ مسیر بازی از پایه‌ی تحصیلی + درس ساخته می‌شود */
function makeLevels(bookId: string, gradeDir: string, subjectDir: string, seeds: LevelSeed[]): GameLevel[] {
  return seeds.map((seed, i) => ({
    id: `${bookId}-${i + 1}`,
    order: i + 1,
    title: seed.title,
    coinReward: seed.coinReward,
    gameFile: seed.file ? `/games/${gradeDir}/${subjectDir}/${seed.file}` : undefined,
  }));
}

// TODO: پایه‌ی تحصیلی از پروفایل کاربر می‌آید؛ فعلاً کلاس اول
export const GRADE_LABEL = 'کلاس اول';

export const BOOKS: BookWorld[] = [
  {
    id: 'math-1',
    title: 'ریاضی اول',
    subject: 'ریاضی',
    worldTitle: 'جزیره‌ی اعداد',
    icon: HiOutlineCalculator,
    levels: makeLevels('math-1', 'grade-1', 'math', [
      { title: 'جزیره‌ی حیوانات', coinReward: 10, file: '01-riyazi_f1_g1.html' },
      { title: 'قطار اعداد فضایی', coinReward: 10, file: '02-riyazi_f1_g2.html' },
      { title: 'شمارش در جزیره', coinReward: 10, file: '03-riyazi_f1_g3.html' },
      { title: 'هیولاهای گرسنه', coinReward: 10, file: '04-riyazi_f1_g4.html' },
      { title: 'آزمایشگاه غذا', coinReward: 10, file: '05-riyazi_f1_g5.html' },
      { title: 'سفر ریتم', coinReward: 10, file: '06-riyazi_f1_g6.html' },
      { title: 'خرگوش مهربان', coinReward: 12, file: '07-riyazi_f1_g7.html' },
      { title: 'نوشتنِ اعداد فارسی', coinReward: 12, file: '08-riyazi_f1_g8.html' },
      { title: 'اعداد لوکو', coinReward: 12, file: '09-riyazi_f1_g9.html' },
      { title: 'سفر ریاضی', coinReward: 12, file: '10-riyazi_f1_g10.html' },
      { title: 'جدول شگفت‌انگیز', coinReward: 12, file: '11-riyazi_f2_g1.html' },
      { title: 'چوب‌کبریت‌های آشپزخانه', coinReward: 12, file: '12-riyazi_f2_g2.html' },
      { title: 'جدول شگفت‌انگیز ۲', coinReward: 12, file: '13-riyazi_f2_g3.html' },
      { title: 'مزرعه‌ی ریاضی', coinReward: 15, file: '14-riyazi_f3_g1.html' },
      { title: 'ماجراجویی تفریق', coinReward: 15, file: '15-riyazi_f6_g1.html' },
      { title: 'بالون‌های پروازی', coinReward: 15, file: '16-riyazi_f6_g2.html' },
      { title: 'ماهی کوچک', coinReward: 15, file: '17-riyazi_f11_g1.html' },
    ]),
  },
  {
    id: 'writing-1',
    title: 'نگارش اول',
    subject: 'نگارش',
    worldTitle: 'قصر کلمه‌ها',
    icon: HiOutlinePencil,
    levels: makeLevels('writing-1', 'grade-1', 'writing', [
      { title: 'کارخانه‌ی خط‌های صاف', coinReward: 15, file: '18-negaresh_f1_g1.html' },
      { title: 'نقاش کوچولو', coinReward: 15, file: '19-negaresh_f1_g2.html' },
      { title: 'خط خمیده', coinReward: 15, file: '20-negaresh_f1_g3.html' },
      { title: 'قطار نگارش', coinReward: 18, file: '21-negaresh_f1_g4.html' },
      { title: 'ماجراهای حروف', coinReward: 18, file: '22-negaresh_f2_g2.html' },
    ]),
  },
  {
    id: 'science-1',
    title: 'علوم اول',
    subject: 'علوم',
    worldTitle: 'آزمایشگاه مخفی',
    icon: HiOutlineBeaker,
    levels: makeLevels('science-1', 'grade-1', 'science', [
      { title: 'کارخانه‌ی خوراکی‌ها', coinReward: 18, file: '23-olom_f3_g1.html' },
    ]),
  },
  {
    id: 'quran-1',
    title: 'قرآن اول',
    subject: 'قرآن',
    worldTitle: 'باغ نور',
    icon: HiOutlineBookOpen,
    levels: makeLevels('quran-1', 'grade-1', 'quran', [
      { title: 'نعمت‌یاب', coinReward: 18, file: '24-ghoran_f1_g1.html' },
      { title: 'بسم‌الله الرحمن الرحیم', coinReward: 18, file: '25-ghoran_f1_g2.html' },
      { title: 'سلام و علیکم', coinReward: 18, file: '26-ghoran_f1_g3.html' },
      { title: 'نقاشیِ بسم‌الله', coinReward: 18, file: '27-ghoran_f1_g4.html' },
    ]),
  },
];

export function bookById(id: string): BookWorld | undefined {
  return BOOKS.find((b) => b.id === id);
}

/** یافتن یک مرحله (و کتابِ آن) با شناسه — برای صفحه‌ی اجرای بازی */
export function levelById(levelId: string): { book: BookWorld; level: GameLevel } | undefined {
  for (const book of BOOKS) {
    const level = book.levels.find((l) => l.id === levelId);
    if (level) return { book, level };
  }
  return undefined;
}

/** ثبتِ تمام‌شدنِ یک مرحله در localStorage (برای وقتی بازی کامل شد) */
export function markLevelCompleted(levelId: string): void {
  const done = completedLevelIds();
  if (done.has(levelId)) return;
  done.add(levelId);
  localStorage.setItem(COMPLETED_KEY, JSON.stringify([...done]));
}

const COMPLETED_KEY = 'luko_completed_games';

/**
 * جایگزینیِ کاملِ پیشرفتِ محلی با فهرستِ سرور.
 * سرور تنها مرجعِ «چه چیزی تمام شده» است، چون سکه و قفلِ مسیر را همان
 * می‌دهد. اگر محلی جلوتر باشد (مثلاً پستِ تکمیل در قطعیِ شبکه نرسیده)،
 * همان مرحله دوباره «نرفته» می‌شود — که درست است، چون سرور هم نشمرده.
 */
export function replaceCompletedLevelIds(ids: string[]): void {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(ids));
}

/** مجموعه‌ی شناسه‌ی مراحلِ تمام‌شده از localStorage */
export function completedLevelIds(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* داده‌ی خراب → خالی */
  }
  return new Set();
}

export type LevelStatus = 'completed' | 'current' | 'locked';

export interface LevelWithStatus extends GameLevel {
  status: LevelStatus;
}

export interface BookProgress {
  levels: LevelWithStatus[];
  completedCount: number;
  total: number;
  coinsEarned: number;
  /** درصد پیشرفت (۰ تا ۱۰۰) */
  percent: number;
}

/** وضعیت مراحلِ یک کتاب: تمام‌شده / همین‌الان / قفل (باز شدن پله‌ای) */
export function bookProgress(book: BookWorld, done: Set<string>): BookProgress {
  let currentAssigned = false;
  const levels: LevelWithStatus[] = book.levels.map((lvl) => {
    if (done.has(lvl.id)) return { ...lvl, status: 'completed' };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...lvl, status: 'current' };
    }
    return { ...lvl, status: 'locked' };
  });

  const completedCount = levels.filter((l) => l.status === 'completed').length;
  const coinsEarned = book.levels
    .filter((l) => done.has(l.id))
    .reduce((sum, l) => sum + l.coinReward, 0);
  const total = book.levels.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return { levels, completedCount, total, coinsEarned, percent };
}

export interface OverallStats {
  totalBooks: number;
  readyBooks: number;
  totalLevels: number;
  completedLevels: number;
  remainingLevels: number;
  coinsEarned: number;
}

/** آمار کلیِ همه‌ی کتاب‌ها */
export function overallStats(done: Set<string>): OverallStats {
  let totalLevels = 0;
  let completedLevels = 0;
  let coinsEarned = 0;
  let readyBooks = 0;

  for (const book of BOOKS) {
    if (book.levels.length > 0) readyBooks += 1;
    totalLevels += book.levels.length;
    for (const lvl of book.levels) {
      if (done.has(lvl.id)) {
        completedLevels += 1;
        coinsEarned += lvl.coinReward;
      }
    }
  }

  return {
    totalBooks: BOOKS.length,
    readyBooks,
    totalLevels,
    completedLevels,
    remainingLevels: totalLevels - completedLevels,
    coinsEarned,
  };
}
