/**
 * پیشرفتِ محلیِ مسیرِ بازی‌ها (localStorage).
 *
 * سرور مرجع است؛ این نسخه فقط برای دو چیز است: مهمانی که حسابِ سروری ندارد،
 * و لحظه‌ای که پستِ تکمیل هنوز نرسیده (بچه نباید منتظرِ شبکه بماند).
 */
const COMPLETED_KEY = 'luko_completed_games';

/** مجموعه‌ی شناسه‌ی مرحله‌های تمام‌شده */
export function completedLevelIds(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* داده‌ی خراب یا دسترسیِ بسته → خالی */
  }
  return new Set();
}

/** ثبتِ تمام‌شدنِ یک مرحله */
export function markLevelCompleted(levelId: string): void {
  const done = completedLevelIds();
  if (done.has(levelId)) return;
  done.add(levelId);
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...done]));
  } catch {
    /* حافظه پر یا بسته — سرور همچنان ثبت می‌کند */
  }
}

/**
 * جایگزینیِ کاملِ پیشرفتِ محلی با فهرستِ سرور.
 * سرور تنها مرجعِ «چه چیزی تمام شده» است، چون سکه و قفلِ مسیر را همان
 * می‌دهد. اگر محلی جلوتر باشد (مثلاً پستِ تکمیل در قطعیِ شبکه نرسیده)،
 * همان مرحله دوباره «نرفته» می‌شود — که درست است، چون سرور هم نشمرده.
 */
export function replaceCompletedLevelIds(ids: string[]): void {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(ids));
  } catch {
    /* حافظه پر یا بسته */
  }
}
