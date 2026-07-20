// TODO: بعد از آماده شدن بک‌اند، کتاب‌ها و مراحل و پیشرفت از API می‌آیند (bookService)
import type { IconType } from 'react-icons';
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineBookmarkSquare,
  HiOutlineCalculator,
  HiOutlinePencil,
  HiOutlineSparkles,
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
      { title: 'جزیره‌ی حیوانات', coinReward: 10, file: 'animals-island.html' },
      { title: 'قطار اعداد', coinReward: 10, file: 'number-train.html' },
      { title: 'شکارچی کوچک', coinReward: 12, file: 'little-hunter.html' },
      { title: 'هیولاهای گرسنه', coinReward: 12, file: 'hungry-monsters.html' },
      { title: 'آشپز کوچولو', coinReward: 12, file: 'little-chef.html' },
      { title: 'سفر ریتم', coinReward: 14, file: 'rhythm-journey.html' },
      { title: 'خرگوش مهربان', coinReward: 14, file: 'kind-rabbit.html' },
      { title: 'اعداد فارسی', coinReward: 15, file: 'persian-numbers.html' },
      { title: 'حدس اعداد فضایی', coinReward: 15, file: 'space-numbers.html' },
      { title: 'سفر ریاضی', coinReward: 20, file: 'math-journey.html' },
    ]),
  },
  {
    id: 'science-1',
    title: 'علوم اول',
    subject: 'علوم',
    worldTitle: 'آزمایشگاه مخفی',
    icon: HiOutlineBeaker,
    levels: makeLevels('science-1', 'grade-1', 'science', [
      { title: 'یادگیری سایه', coinReward: 10, file: 'shadow.html' },
      { title: 'آزمایشگاه گوجه', coinReward: 12, file: 'tomato-lab.html' },
      { title: 'آزمایشگاه جادویی آب', coinReward: 15, file: 'water-lab.html' },
    ]),
  },
  {
    id: 'writing-1',
    title: 'نگارش اول',
    subject: 'نگارش',
    worldTitle: 'قصر کلمه‌ها',
    icon: HiOutlinePencil,
    levels: makeLevels('writing-1', 'grade-1', 'writing', [
      { title: 'نگارش حرف سین', coinReward: 12, file: 'letter-seen.html' },
      { title: 'حرفِ اولِ اسمم', coinReward: 12 },
      { title: 'کلمه‌سازی', coinReward: 14 },
      { title: 'جمله‌ی خندان', coinReward: 16 },
    ]),
  },
  {
    id: 'quran-1',
    title: 'قرآن اول',
    subject: 'قرآن',
    worldTitle: 'باغ نور',
    icon: HiOutlineBookOpen,
    levels: makeLevels('quran-1', 'grade-1', 'quran', [
      { title: 'قطار قرآن؛ سوره‌ی توحید', coinReward: 12, file: 'quran-train.html' },
      { title: 'آیه‌های نور', coinReward: 15 },
    ]),
  },
  {
    id: 'reading-1',
    title: 'فارسی: خوانداری',
    subject: 'فارسی',
    worldTitle: 'سرزمینِ حرف‌ها',
    icon: HiOutlineBookmarkSquare,
    levels: [],
  },
  {
    id: 'gifts-1',
    title: 'هدیه‌های آسمان',
    subject: 'هدیه‌ها',
    worldTitle: 'کهکشانِ مهربونی',
    icon: HiOutlineSparkles,
    levels: [],
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
