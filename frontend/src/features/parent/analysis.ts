import type { ChildReport } from './types';

/**
 * لایه‌ی «تحلیل» پنل والدین.
 *
 * فعلاً همه‌ی جمله‌ها با قاعده‌های شفاف از همان داده‌های گزارش ساخته می‌شوند تا
 * والد چیزی ببیند که بشود پشتش عدد نشان داد. وقتی سرویسِ هوش مصنوعی آماده شد،
 * فقط منبعِ `ChildAnalysis` عوض می‌شود (بک‌اند همین شکل را برمی‌گرداند) و
 * کامپوننت‌ها دست‌نخورده می‌مانند.
 */

export type Verdict = 'strong' | 'steady' | 'attention' | 'idle';

/** یک ستونِ نمره‌ی هفته — والد باید بتواند ببیند نمره از کجا آمده */
export interface ScorePart {
  key: string;
  label: string;
  /** ۰ تا ۱۰۰ — درصدِ کسب‌شده از این بخش */
  value: number;
  /** وزنِ این بخش در نمره‌ی کل */
  weight: number;
  /** عددِ واقعیِ پشتِ این بخش، به زبانِ ساده */
  detail: string;
}

export interface AnalysisFinding {
  id: string;
  tone: 'good' | 'watch' | 'tip';
  title: string;
  body: string;
}

export interface ChildAnalysis {
  /** `auto` = ساخته‌شده از قاعده‌های همین فایل، `ai` = آمده از سرویسِ هوش مصنوعی */
  source: 'auto' | 'ai';
  verdict: Verdict;
  verdictLabel: string;
  /** نمره‌ی هفته، ۰ تا ۱۰۰ */
  score: number;
  parts: ScorePart[];
  headline: string;
  narrative: string;
  findings: AnalysisFinding[];
  action: { title: string; body: string } | null;
  /** تعدادِ پاسخ‌هایی که این تحلیل روی آن‌ها بسته شده */
  sampleSize: number;
}

/** هدف‌های هفتگی که نمره نسبت به آن‌ها سنجیده می‌شود */
const GOAL = { activeDays: 5, minutes: 90, subjects: 3 };

const fa = (value: number) => value.toLocaleString('fa-IR');

const pct = (value: number, goal: number) => Math.max(0, Math.min(100, Math.round((value / goal) * 100)));

function kpiValue(report: ChildReport, key: string): number {
  return report.kpis.find((item) => item.key === key)?.value ?? 0;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'هفته‌ی قوی',
  steady: 'رو به جلو',
  attention: 'نیاز به توجه',
  idle: 'بدون فعالیت',
};

/** جمله‌ی تیتر — وقتی همه‌چیز خوب است تعریف می‌کند، وگرنه ضعیف‌ترین بخش را نام می‌برد */
function buildHeadline(name: string, verdict: Verdict, weakest: ScorePart): string {
  if (verdict === 'idle') return `${name} این هفته بازی‌ای انجام نداده است`;
  if (verdict === 'strong') return `${name} هفته‌ی خوبی پشت سر گذاشت`;

  const byPart: Record<string, string> = {
    streak: `تمرینِ ${name} این هفته منظم نبود`,
    minutes: `زمانِ یادگیریِ ${name} این هفته کم بود`,
    accuracy: `${name} این هفته بیشتر از قبل اشتباه کرد`,
    variety: `${name} این هفته فقط روی یک درس مانده`,
  };
  return byPart[weakest.key] ?? `${name} این هفته آرام پیش رفت`;
}

/** دو تا سه جمله‌ی ساده که همان اعدادِ بالای صفحه را روایت می‌کند */
function buildNarrative(report: ChildReport, name: string, activeDays: number): string {
  const minutes = kpiValue(report, 'time');
  const accuracy = kpiValue(report, 'accuracy');
  const games = kpiValue(report, 'games');

  if (minutes === 0 && games === 0) {
    return `در هفت روز گذشته هیچ بازی‌ای از ${name} ثبت نشده است. با «بازی روز» می‌توانید یک بازیِ کوتاه برایش بگذارید تا دوباره شروع کند.`;
  }

  const first = `${name} این هفته ${fa(minutes)} دقیقه بازی کرد؛ در ${fa(activeDays)} روز از هفت روز، و ${fa(accuracy)}٪ پاسخ‌هایش درست بود.`;

  const busiest = [...report.subjects].sort((a, b) => b.gamesDone - a.gamesDone)[0];
  const second =
    busiest && busiest.gamesDone > 0
      ? ` بیشترِ تمرینش روی «${busiest.label}» بود${busiest.weakestTopic ? ` و در همان درس، «${busiest.weakestTopic}» از بقیه عقب‌تر است` : ''}.`
      : '';

  const session = kpiValue(report, 'session');
  const third = session > 0 && session < 5 ? ` جلسه‌هایش کوتاه بوده (میانگین ${fa(session)} دقیقه).` : '';

  return first + second + third;
}

/** نکته‌های محلی — چیزهایی که از خودِ گزارش درمی‌آید و بک‌اند جداگانه نمی‌فرستد */
function localFindings(report: ChildReport): AnalysisFinding[] {
  const out: AnalysisFinding[] = [];

  const totalHourly = report.hourly.reduce((sum, bucket) => sum + bucket.count, 0);
  const lateNight = report.hourly
    .filter((bucket) => bucket.hour >= 21 || bucket.hour <= 5)
    .reduce((sum, bucket) => sum + bucket.count, 0);

  if (totalHourly > 0 && lateNight / totalHourly > 0.2) {
    out.push({
      id: 'late-night',
      tone: 'watch',
      title: 'بازی نزدیکِ ساعتِ خواب',
      body: `${fa(Math.round((lateNight / totalHourly) * 100))}٪ از فعالیتش بعد از ساعت ۲۱ یا پیش از ۶ صبح بوده است؛ جابه‌جا کردنِ آن به بعدازظهر معمولاً تمرکز را بهتر می‌کند.`,
    });
  }

  const session = kpiValue(report, 'session');
  if (session > 0 && session < 5) {
    out.push({
      id: 'short-session',
      tone: 'tip',
      title: 'جلسه‌های خیلی کوتاه',
      body: `میانگینِ هر جلسه ${fa(session)} دقیقه است. یک بازیِ ${fa(10)} دقیقه‌ای در روز، از چند بازیِ دو دقیقه‌ای نتیجه‌ی بهتری می‌دهد.`,
    });
  }

  return out;
}

/** پیشنهادِ عملیِ این هفته — همیشه یک کارِ مشخص، نه توصیه‌ی کلی */
function buildAction(report: ChildReport, activeDays: number): ChildAnalysis['action'] {
  const weakTopic = [...report.topics]
    .filter((topic) => topic.asked >= 5)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  if (weakTopic && weakTopic.accuracy < 75) {
    return {
      title: `این هفته روی «${weakTopic.label}» تمرکز کنید`,
      body: `دقتش در این مبحث ${fa(weakTopic.accuracy)}٪ است (${fa(weakTopic.asked)} پاسخ). از بخش «بازی روز» یک بازیِ مربوط به همین مبحث برایش انتخاب کنید.`,
    };
  }

  if (activeDays < 3) {
    return {
      title: 'یک ساعتِ ثابتِ روزانه بگذارید',
      body: `فقط ${fa(activeDays)} روز از هفت روز فعال بوده است. یک زمانِ کوتاهِ ثابت در روز، بیشتر از یک جلسه‌ی طولانی در هفته اثر دارد.`,
    };
  }

  const untouched = report.subjects.find((subject) => subject.gamesDone === 0 && subject.gamesTotal > 0);
  if (untouched) {
    return {
      title: `درسِ «${untouched.label}» هنوز شروع نشده`,
      body: `${fa(untouched.gamesTotal)} بازی در این درس آماده است و هنوز سراغش نرفته. یکی از آن‌ها را برای بازیِ روز بگذارید.`,
    };
  }

  return {
    title: 'همین مسیر را ادامه دهید',
    body: 'الگوی این هفته سالم بوده است؛ فقط حواستان به ثابت‌ماندنِ زمانِ روزانه باشد.',
  };
}

/** ساختِ تحلیلِ کاملِ یک فرزند از روی گزارشِ هفته */
export function buildAnalysis(report: ChildReport, childName: string): ChildAnalysis {
  const minutes = kpiValue(report, 'time');
  const accuracy = kpiValue(report, 'accuracy');
  const activeDays = report.week.filter((day) => day.minutes > 0).length;
  const touchedSubjects = report.subjects.filter((subject) => subject.gamesDone > 0).length;
  // نمونه‌ی تحلیل = پاسخ‌های همین هفته (topics بازه‌ی هشت‌هفته‌ای دارد و اینجا گمراه‌کننده است)
  const sampleSize = report.answersThisWeek ?? 0;

  const parts: ScorePart[] = [
    {
      key: 'streak',
      label: 'پیوستگی',
      value: pct(activeDays, GOAL.activeDays),
      weight: 30,
      detail: `${fa(activeDays)} روزِ فعال از ۷ روز`,
    },
    {
      key: 'minutes',
      label: 'زمانِ یادگیری',
      value: pct(minutes, GOAL.minutes),
      weight: 25,
      detail: `${fa(minutes)} دقیقه از هدفِ ${fa(GOAL.minutes)} دقیقه`,
    },
    {
      key: 'accuracy',
      label: 'دقتِ پاسخ‌ها',
      value: Math.max(0, Math.min(100, accuracy)),
      weight: 30,
      detail: sampleSize > 0 ? `${fa(accuracy)}٪ از ${fa(sampleSize)} پاسخ` : 'هنوز پاسخی ثبت نشده',
    },
    {
      key: 'variety',
      label: 'تنوعِ درس‌ها',
      value: pct(touchedSubjects, GOAL.subjects),
      weight: 15,
      detail: `${fa(touchedSubjects)} درس از ${fa(report.subjects.length)} درس`,
    },
  ];

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const rawScore = Math.round(
    parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
  );

  // هفته‌ی بدونِ فعالیت: نمره صفر است؛ عددِ کوچکِ باقی‌مانده از «تنوع» گمراه‌کننده بود
  const idle = minutes === 0 && sampleSize === 0;
  const score = idle ? 0 : rawScore;
  const verdict: Verdict = idle ? 'idle' : score >= 72 ? 'strong' : score >= 45 ? 'steady' : 'attention';

  const weakest = [...parts].sort((a, b) => a.value - b.value)[0];

  // نکته‌های بک‌اند اولویت دارند؛ اگر کم بودند با نکته‌های محلی کامل می‌شوند
  const findings = [...report.insights, ...localFindings(report)].slice(0, 4);

  return {
    source: 'auto',
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    score,
    parts,
    headline: buildHeadline(childName, verdict, weakest),
    narrative: buildNarrative(report, childName, activeDays),
    findings,
    action: idle ? null : buildAction(report, activeDays),
    sampleSize,
  };
}
