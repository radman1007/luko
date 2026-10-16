/**
 * نمونه‌ی «آموزش» برای حالتِ مهمان (بی‌حساب، بی‌API) — چند مقاله از همان مقاله‌های واقعیِ کتابخانه.
 * شکل همان پاسخِ سرور است تا صفحه‌ها برای مهمان شاخه‌ی جدا نخواهند.
 */
import type { LearnDetail, LearnList, LearnSummary } from '../../learnApi';

const base = { cover: '', author: 'تیم آموزشی لوکو', isNew: false, views: 0, publishedFa: '۲۲ مهر ۱۴۰۵', saved: false, done: false };

const ITEMS: LearnSummary[] = [
  { ...base, id: 1, kind: 'article', kindLabel: 'مقاله', title: 'بعد از بازی چه بپرسیم؟ هفت سؤالِ باز',
    summary: 'سؤالِ درست بعد از بازی، چند دقیقه بازی را به یک درسِ ماندگار تبدیل می‌کند.', topic: 'learning',
    topicLabel: 'یادگیری و درس', minutes: 2, premium: false, locked: false, featured: true },
  { ...base, id: 2, kind: 'article', kindLabel: 'مقاله', title: 'تشویقِ درست: تلاش را ببینید، نه فقط نتیجه',
    summary: 'جمله‌ی «تو باهوشی» انگیزه نمی‌سازد؛ تشویقِ مشخص و صادقانه می‌سازد.', topic: 'emotions',
    topicLabel: 'احساسات و رفتار', minutes: 1, premium: false, locked: false, featured: false },
  { ...base, id: 3, kind: 'article', kindLabel: 'مقاله', title: 'بازی و صفحه‌نمایش: چقدر و چطور؟',
    summary: 'کم ولی منظم، با یک ساعتِ ثابت و دور از وقتِ خواب؛ چند قاعده‌ی ساده برای خانه.', topic: 'screen',
    topicLabel: 'بازی و صفحه‌نمایش', minutes: 1, premium: false, locked: false, featured: false },
  { ...base, id: 4, kind: 'article', kindLabel: 'مقاله', title: 'ساختنِ یک عادتِ کوچکِ روزانه در چهار هفته',
    summary: 'برنامه‌ی هفته‌به‌هفته برای این‌که بازیِ آموزشیِ کوتاه، بی‌کشمکش بخشی از روزِ فرزندتان شود.',
    topic: 'habits', topicLabel: 'عادت و برنامه‌ی روزانه', minutes: 2, premium: true, locked: true, featured: false },
  { ...base, id: 5, kind: 'article', kindLabel: 'مقاله', title: 'خواب و یادگیری: چرا بازیِ آخرِ شب کمکی نمی‌کند',
    summary: 'ذهن در خواب آموخته‌های روز را تثبیت می‌کند؛ چند تغییرِ ساده برای شب‌های آرام‌تر.', topic: 'health',
    topicLabel: 'خواب و سلامت', minutes: 2, premium: true, locked: true, featured: false },
  { ...base, id: 6, kind: 'article', kindLabel: 'مقاله', title: 'ریاضی در خانه: ده بازیِ ساده برای شمارش، جمع و تفریق',
    summary: 'با قاشق و دکمه و پله، ریاضی را از دفتر بیرون بیاورید؛ ده بازیِ پنج‌دقیقه‌ای.', topic: 'learning',
    topicLabel: 'یادگیری و درس', minutes: 2, premium: true, locked: true, featured: false },
];

export const GUEST_LEARN: LearnList = {
  premium: false,
  featured: ITEMS[0],
  items: ITEMS,
  counts: { article: ITEMS.length, video: 0, podcast: 0 },
  topics: [
    { key: 'learning', label: 'یادگیری و درس', count: 2 },
    { key: 'habits', label: 'عادت و برنامه‌ی روزانه', count: 1 },
    { key: 'emotions', label: 'احساسات و رفتار', count: 1 },
    { key: 'screen', label: 'بازی و صفحه‌نمایش', count: 1 },
    { key: 'health', label: 'خواب و سلامت', count: 1 },
  ],
  locked: 3,
  forChild: {
    childName: 'آرش',
    picks: [
      { item: ITEMS[5], reason: 'آرش در «تفریق» تمرینِ بیشتری لازم دارد' },
      { item: ITEMS[2], reason: 'زمانِ بازی را می‌شود به ساعتِ بهتری برد' },
    ],
  },
};

const BODY: Record<number, string> = {
  1: '<p>بچه‌ها وقتی چیزی را برای کسی توضیح می‌دهند، خودشان بهتر یادش می‌گیرند. همین چند دقیقه گفت‌وگوی بعد از بازی، کارِ مرور را انجام می‌دهد؛ بی‌آن‌که شبیهِ امتحان باشد.</p>'
    + '<h2>هفت سؤالِ پیشنهادی</h2><ul><li>امروز چه چیزِ تازه‌ای یاد گرفتی؟</li><li>کدام قسمتش از همه سخت‌تر بود؟ چطور از پسش برآمدی؟</li>'
    + '<li>اگر بخواهی این بازی را به من یاد بدهی، از کجا شروع می‌کنی؟</li><li>یک جا که اشتباه کردی و بعد درستش کردی را برایم تعریف کن.</li>'
    + '<li>این چیزی که یاد گرفتی را کجای خانه یا مدرسه می‌بینیم؟</li><li>فردا دوست داری کدام بازی را امتحان کنی؟ چرا؟</li>'
    + '<li>از یک تا پنج، چقدر به خودت افتخار می‌کنی؟</li></ul>'
    + '<p><strong>هر شب یکی دو سؤال کافی است.</strong> بازجویی نکنید؛ گفت‌وگو کوتاه و دوستانه باشد.</p>',
  2: '<p>بچه‌ای که مدام می‌شنود «باهوش است»، ممکن است کم‌کم از کارهای سخت دوری کند تا این برچسب خراب نشود. بچه‌ای که برای تلاشش دیده می‌شود، یاد می‌گیرد سختی بخشی از راه است.</p>'
    + '<h2>تشویقِ مشخص چه شکلی است؟</h2><ul><li>به‌جای «آفرین، عالی بود» بگویید: «دیدم سه بار امتحان کردی تا درست شد.»</li>'
    + '<li>به‌جای «تو نابغه‌ای» بگویید: «این بار دقت کردی و با حوصله جواب دادی.»</li></ul>',
  3: '<p>بازیِ آموزشی وقتی بیشترین اثر را دارد که کوتاه، منظم و در زمانِ مناسب باشد.</p>'
    + '<h2>چند قاعده‌ی ساده</h2><ul><li><strong>کوتاه و هرروزه:</strong> روزی ده تا بیست دقیقه بازیِ آموزشی کافی است.</li>'
    + '<li><strong>یک ساعتِ ثابت:</strong> ساعتِ ثابت عادت می‌سازد و کشمکش را کم می‌کند.</li>'
    + '<li><strong>دور از خواب:</strong> یک ساعت پیش از خواب صفحه‌نمایش را کنار بگذارید.</li></ul>',
  4: '<p>عادت با اراده ساخته نمی‌شود؛ با تکرارِ یک کارِ کوچک در یک زمانِ ثابت ساخته می‌شود.</p>',
  5: '<p>آنچه کودک در روز تمرین می‌کند، در خواب مرتب و ماندگار می‌شود.</p>',
  6: '<p>بچه‌ها ریاضی را با دست بهتر می‌فهمند تا با چشم.</p>',
};

export function guestDetail(id: number): LearnDetail | undefined {
  const item = ITEMS.find((row) => row.id === id);
  if (!item) return undefined;
  return {
    ...item,
    bodyHtml: BODY[id] ?? '',
    media: null,
    seconds: 0,
    related: ITEMS.filter((row) => row.id !== id).slice(0, 3),
  };
}
