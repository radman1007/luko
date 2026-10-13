import type { AssistantThread } from '../../assistantApi';

/** گفت‌وگوی نمونه برای حالتِ مهمان (بی‌حساب، بی‌API) — همان شکلِ پاسخِ سرور */
export const GUEST_THREAD: AssistantThread = {
  enabled: true,
  pending: false,
  quota: {
    premium: false,
    freeLimit: 5,
    premiumLimits: { flash: 40, pro: 25, luna: 10 },
    tiers: [
      { key: 'flash', label: 'پایه', name: 'DeepSeek V4 Flash', locked: false, used: 1, limit: 5, left: 4 },
      { key: 'pro', label: 'حرفه‌ای', name: 'DeepSeek V4 Pro', locked: true, used: 0, limit: 0, left: 0 },
      { key: 'luna', label: 'پیشرفته', name: 'GPT-5.6 Luna', locked: true, used: 0, limit: 0, left: 0 },
    ],
  },
  suggestions: [
    'چطور در «تفریق» کمکش کنم؟',
    'این هفته در چه چیزی بهتر شد؟',
    'برای هفته‌ی بعد چه برنامه‌ای پیشنهاد می‌کنی؟',
  ],
  messages: [
    {
      id: 1, role: 'user', status: 'done', tier: '', tierLabel: '', modelName: '', atFa: 'امروز، ۱۸:۰۴',
      content: 'آرش در تفریق زیاد اشتباه می‌کند، چطور در خانه کمکش کنم؟',
    },
    {
      id: 2, role: 'assistant', status: 'done', tier: 'flash', tierLabel: 'پایه', modelName: 'DeepSeek V4 Flash',
      atFa: 'امروز، ۱۸:۰۴',
      content: 'در هشت هفته‌ی اخیر دقتِ آرش در «تفریق» ۶۸٪ بوده و بیشترِ خطاهایش از نوعِ «روش و محاسبه» است؛ '
        + 'یعنی مفهوم را می‌داند ولی در مرحله‌ها اشتباه می‌کند.\n'
        + '• روزی ۱۰ دقیقه با حبه‌قند یا دکمه، تفریق را عملی انجام دهید.\n'
        + '• از او بخواهید هر قدم را بلند بگوید تا ببینید کجا اشتباه می‌کند.\n'
        + '• برای تلاشش تشویقش کنید، نه فقط جوابِ درست.',
    },
  ],
};
