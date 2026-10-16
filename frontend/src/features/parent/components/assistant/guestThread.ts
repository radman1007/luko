import type { AssistantThread } from '../../assistantApi';

/** گفت‌وگوی نمونه برای حالتِ مهمان (بی‌حساب، بی‌API) — همان شکلِ پاسخِ سرور */
export const GUEST_THREAD: AssistantThread = {
  enabled: true,
  pending: false,
  conversation: { id: 1, title: 'آرش در تفریق زیاد اشتباه می‌کند', updatedFa: 'امروز، ۱۸:۰۴' },
  history: { locked: true, count: 1 },
  questionMax: 1000,
  quota: {
    premium: false,
    period: 'week',
    freeLimit: 5,
    premiumLimits: { flash: 20, luna: 10, pro: 5 },
    tiers: [
      { key: 'flash', label: 'لوکو سریع', note: 'پاسخ‌های سریع و کاربردی برای سؤال‌های روزمره', locked: false, used: 1,
        limit: 5, left: 4 },
      { key: 'luna', label: 'لوکو همراه', note: 'راهنمایی دقیق‌تر و پیشنهادهای عملی برای همراهی با فرزندت', locked: true,
        used: 0, limit: 0, left: 0 },
      { key: 'pro', label: 'لوکو بینش', note: 'بررسی عمیق‌تر موضوعات پیچیده و ارائه‌ی پیشنهادهای چندجانبه', locked: true,
        used: 0, limit: 0, left: 0 },
    ],
  },
  suggestions: [
    'چطور در «تفریق» کمکش کنم؟',
    'این هفته در چه چیزی بهتر شد؟',
    'برای هفته‌ی بعد چه برنامه‌ای پیشنهاد می‌کنی؟',
  ],
  messages: [
    {
      id: 1, role: 'user', status: 'done', tier: '', tierLabel: '', atFa: 'امروز، ۱۸:۰۴',
      content: 'آرش در تفریق زیاد اشتباه می‌کند، چطور در خانه کمکش کنم؟',
    },
    {
      id: 2, role: 'assistant', status: 'done', tier: 'flash', tierLabel: 'لوکو سریع',
      atFa: 'امروز، ۱۸:۰۴',
      content: 'در هشت هفته‌ی اخیر دقتِ آرش در «تفریق» ۶۸٪ بوده و بیشترِ خطاهایش از نوعِ «روش و محاسبه» است؛ '
        + 'یعنی مفهوم را می‌داند ولی در مرحله‌ها اشتباه می‌کند.\n'
        + '• روزی ۱۰ دقیقه با حبه‌قند یا دکمه، تفریق را عملی انجام دهید.\n'
        + '• از او بخواهید هر قدم را بلند بگوید تا ببینید کجا اشتباه می‌کند.\n'
        + '• برای تلاشش تشویقش کنید، نه فقط جوابِ درست.',
    },
  ],
};
