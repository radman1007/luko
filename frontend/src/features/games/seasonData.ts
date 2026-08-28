/**
 * سیزنِ تالار بازی‌ها.
 *
 * جای «کتاب» را یک مسیرِ فصلی گرفته است: همه‌ی بازی‌ها یک صفِ واحدند و
 * **ترتیبشان از نامِ فایل** می‌آید (پیشوندِ عددیِ سراسری مثل `07-little-hunter.html`).
 * هر هفته یک دسته‌ی تازه از این صف باز می‌شود؛ هفته‌های جلوتر پشتِ ابر پنهان‌اند.
 *
 * شناسه‌ی مرحله‌ها همان شناسه‌ی booksData است تا پیشرفتِ ثبت‌شده‌ی بچه‌ها از دست نرود
 * و صفحه‌ی اجرای بازی (`/game/:id`) بدونِ تغییر کار کند.
 *
 * TODO: بعد از بک‌اند، سیزن و تاریخِ شروعش از API می‌آید (فعلاً همین‌جا ثابت است).
 */
import { BOOKS, completedLevelIds } from '@/features/books/booksData';

export type SubjectKey = 'math' | 'science' | 'writing' | 'quran' | 'reading' | 'other';

export interface SeasonStage {
  /** همان شناسه‌ی مرحله در booksData */
  id: string;
  /** جایگاه در مسیرِ سیزن — از پیشوندِ عددیِ نامِ فایل */
  order: number;
  title: string;
  subject: string;
  subjectKey: SubjectKey;
  coinReward: number;
  /** نامِ فایل؛ همان چیزی که ترتیب را تعیین می‌کند */
  file: string;
  week: number;
  /**
   * مسیر پشتِ‌سرهم است: تا مرحله‌ی قبلی تمام نشود این یکی باز نمی‌شود.
   * مرحله‌های تمام‌شده همیشه بازند تا بشود دوباره بازی‌شان کرد.
   */
  locked: boolean;
}

export type WeekState = 'done' | 'current' | 'past' | 'locked';

export interface SeasonWeek {
  index: number;
  label: string;
  stages: SeasonStage[];
  state: WeekState;
  /** تاریخِ بازشدن (برای هفته‌های قفل) */
  unlocksAt: Date;
  completedCount: number;
}

export interface SeasonState {
  weeks: SeasonWeek[];
  /** هفته‌هایی که بچه می‌تواند همین حالا بازی کند */
  openWeeks: SeasonWeek[];
  /** هفته‌های هنوز نرسیده — پشتِ ابر */
  cloudedWeeks: SeasonWeek[];
  currentWeek: number;
  totalWeeks: number;
  /** مرحله‌ی بعدی که باید بازی شود (اولین کامل‌نشده‌ی هفته‌های باز) */
  nextStage?: SeasonStage;
  openStages: number;
  completedStages: number;
  hiddenStages: number;
  totalStages: number;
  coinsEarned: number;
  coinsOpen: number;
  /** تعدادِ روز تا بازشدنِ هفته‌ی بعد؛ undefined یعنی سیزن تمام شده */
  daysToNextWeek?: number;
  seasonFinished: boolean;
}

/** پیکربندیِ سیزنِ جاری */
export const SEASON = {
  id: 'season-1',
  /** شماره‌ی سیزن برای نمایش */
  number: 1,
  title: 'سیزنِ اول',
  subtitle: 'نقشه‌ی جزیره‌ی اعداد',
  /** شنبه‌ی شروعِ سیزن */
  startsAt: new Date('2026-08-08T00:00:00'),
  /** چند مرحله در هر هفته باز می‌شود */
  stagesPerWeek: 3,
} as const;

const SUBJECT_KEYS: Record<string, SubjectKey> = {
  math: 'math',
  science: 'science',
  writing: 'writing',
  quran: 'quran',
  reading: 'reading',
};

/** `/games/grade-1/math/07-little-hunter.html` → `math` */
function subjectKeyOf(gameFile: string): SubjectKey {
  const parts = gameFile.split('/').filter(Boolean);
  const dir = parts[parts.length - 2] ?? '';
  return SUBJECT_KEYS[dir] ?? 'other';
}

/** نامِ فایل بدونِ مسیر */
function baseName(gameFile: string): string {
  return gameFile.split('/').pop() ?? gameFile;
}

/**
 * ترتیبِ مرحله از نامِ فایل: پیشوندِ عددی (`07-...`) اول می‌آید؛
 * فایلِ بدونِ پیشوند ته‌ی صف و بینِ خودشان الفبایی مرتب می‌شود.
 */
function fileOrder(file: string): number {
  const match = /^(\d+)/.exec(file);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function byFileName(a: string, b: string): number {
  const diff = fileOrder(a) - fileOrder(b);
  return diff !== 0 ? diff : a.localeCompare(b, 'en');
}

let stagesCache: SeasonStage[] | null = null;

/**
 * همه‌ی مرحله‌های سیزن، مرتب‌شده بر اساسِ نامِ فایل.
 * ورودی‌اش ثابت است (BOOKS)، پس یک‌بار ساخته و نگه داشته می‌شود؛ وگرنه
 * هر رندرِ نقشه یک flatMap و sort روی کلِ بازی‌ها می‌زد.
 */
export function seasonStages(): SeasonStage[] {
  if (stagesCache) return stagesCache;
  const flat = BOOKS.flatMap((book) =>
    book.levels
      .filter((level) => Boolean(level.gameFile))
      .map((level) => ({
        id: level.id,
        title: level.title,
        subject: book.subject,
        subjectKey: subjectKeyOf(level.gameFile as string),
        coinReward: level.coinReward,
        file: baseName(level.gameFile as string),
      })),
  );

  flat.sort((a, b) => byFileName(a.file, b.file));

  stagesCache = flat.map((stage, i) => ({
    ...stage,
    order: i + 1,
    week: Math.floor(i / SEASON.stagesPerWeek) + 1,
    // قفلِ واقعی به پیشرفتِ بچه بستگی دارد و در `seasonState` تعیین می‌شود
    locked: false,
  }));
  return stagesCache;
}

function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(value: Date, days: number): Date {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** چند هفته از سیزن تا امروز باز شده است */
export function releasedWeeks(today: Date, totalWeeks: number): number {
  const days = Math.floor((startOfDay(today).getTime() - startOfDay(SEASON.startsAt).getTime()) / DAY_MS);
  if (days < 0) return 0;
  return Math.min(Math.floor(days / 7) + 1, totalWeeks);
}

/** وضعیتِ کاملِ سیزن برای امروز */
export function seasonState(done: Set<string> = completedLevelIds(), today: Date = new Date()): SeasonState {
  const stages = seasonStages();
  const totalWeeks = Math.max(1, Math.ceil(stages.length / SEASON.stagesPerWeek));
  const currentWeek = releasedWeeks(today, totalWeeks);

  // مرحله‌ی جاری = اولین نرفته‌ی هفته‌های بازشده. هرچه بعد از آن است قفل
  // است، مگر خودش قبلاً رفته شده باشد (بازیِ دوباره همیشه آزاد است).
  const releasedStages = stages.filter((stage) => stage.week <= currentWeek);
  const current = releasedStages.find((stage) => !done.has(stage.id));
  const withLock = (stage: SeasonStage): SeasonStage => ({
    ...stage,
    locked: !done.has(stage.id) && (current === undefined || stage.order > current.order),
  });

  const weeks: SeasonWeek[] = [];
  for (let index = 1; index <= totalWeeks; index += 1) {
    const weekStages = stages.filter((stage) => stage.week === index).map(withLock);
    const completedCount = weekStages.filter((stage) => done.has(stage.id)).length;
    const released = index <= currentWeek;
    const allDone = weekStages.length > 0 && completedCount === weekStages.length;

    let state: WeekState = 'locked';
    if (released) {
      if (allDone) state = 'done';
      else state = index === currentWeek ? 'current' : 'past';
    }

    weeks.push({
      index,
      label: `هفته‌ی ${index.toLocaleString('fa-IR')}`,
      stages: weekStages,
      state,
      unlocksAt: addDays(SEASON.startsAt, (index - 1) * 7),
      completedCount,
    });
  }

  const openWeeks = weeks.filter((week) => week.state !== 'locked');
  const cloudedWeeks = weeks.filter((week) => week.state === 'locked');
  const openStageList = openWeeks.flatMap((week) => week.stages);
  const completedStages = openStageList.filter((stage) => done.has(stage.id)).length;
  const seasonFinished = cloudedWeeks.length === 0 && completedStages === openStageList.length;

  const daysToNextWeek = cloudedWeeks.length
    ? Math.max(
        0,
        Math.ceil((startOfDay(cloudedWeeks[0].unlocksAt).getTime() - startOfDay(today).getTime()) / DAY_MS),
      )
    : undefined;

  return {
    weeks,
    openWeeks,
    cloudedWeeks,
    currentWeek,
    totalWeeks,
    nextStage: current && openStageList.find((stage) => stage.id === current.id),
    openStages: openStageList.length,
    completedStages,
    hiddenStages: stages.length - openStageList.length,
    totalStages: stages.length,
    coinsEarned: openStageList
      .filter((stage) => done.has(stage.id))
      .reduce((sum, stage) => sum + stage.coinReward, 0),
    coinsOpen: openStageList
      .filter((stage) => !done.has(stage.id))
      .reduce((sum, stage) => sum + stage.coinReward, 0),
    daysToNextWeek,
    seasonFinished,
  };
}
