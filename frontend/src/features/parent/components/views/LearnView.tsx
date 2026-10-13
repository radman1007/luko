import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineChevronDown,
  HiOutlineClock,
  HiOutlineHandThumbUp,
  HiOutlineLifebuoy,
  HiOutlineSun,
} from 'react-icons/hi2';
import styles from './LearnView.module.css';

interface Lesson {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  summary: string;
  points: string[];
}

/** آموزشِ والدین: درس‌های کوتاه و عملی برای همراهیِ فرزند در یادگیری */
const LESSONS: Lesson[] = [
  {
    id: 'ask', icon: HiOutlineChatBubbleLeftRight, title: 'بعد از بازی چه بپرسیم؟',
    summary: 'سؤالِ باز، بچه را به توضیح‌دادن و فکرکردن دعوت می‌کند.',
    points: [
      'به‌جای «درست بود یا غلط؟» بپرسید «امروز چه چیزِ تازه‌ای یاد گرفتی؟»',
      '«کدام قسمتش سخت بود؟ چطور از پسش برآمدی؟» به او فرصتِ مرور می‌دهد.',
      'بگذارید بازی را به شما یاد بدهد؛ توضیح‌دادن، یادگیری را عمیق‌تر می‌کند.',
    ],
  },
  {
    id: 'praise', icon: HiOutlineHandThumbUp, title: 'تشویقِ تلاش، نه فقط نتیجه',
    summary: 'تشویقِ مشخص و صادقانه انگیزه‌ی ادامه دادن را می‌سازد.',
    points: [
      '«دیدم چند بار امتحان کردی تا درست شد» از «تو باهوشی» اثرِ بیشتری دارد.',
      'جزئیات را بگویید: «این بار سریع‌تر و با دقتِ بیشتری جواب دادی.»',
      'او را با خواهر، برادر یا هم‌کلاسی مقایسه نکنید؛ فقط با دیروزِ خودش.',
    ],
  },
  {
    id: 'mistake', icon: HiOutlineLifebuoy, title: 'وقتی اشتباه می‌کند',
    summary: 'اشتباه بخشی از یادگیری است، نه نشانه‌ی ضعف.',
    points: [
      'آرام بمانید؛ واکنشِ شما تعیین می‌کند دفعه‌ی بعد امتحان کند یا نه.',
      'بپرسید «چطور به این جواب رسیدی؟»؛ معمولاً خودش اشتباه را پیدا می‌کند.',
      'جواب را نگویید؛ یک راهنماییِ کوچک بدهید و بگذارید دوباره تلاش کند.',
    ],
  },
  {
    id: 'screen', icon: HiOutlineClock, title: 'زمانِ صفحه‌نمایش؛ کم ولی منظم',
    summary: 'چند دقیقه‌ی هرروزه از یک ساعتِ گاه‌به‌گاه مفیدتر است.',
    points: [
      'برای کودکِ دبستانی، روزی ۱۰ تا ۲۰ دقیقه بازیِ آموزشی کافی است.',
      'یک ساعتِ ثابت (مثلاً بعد از ناهار) عادت می‌سازد و کشمکش را کم می‌کند.',
      'یک ساعت پیش از خواب صفحه‌نمایش را کنار بگذارید و کنارش بازیِ بیرون و کتاب داشته باشید.',
    ],
  },
  {
    id: 'habit', icon: HiOutlineSun, title: 'یک عادتِ کوچکِ روزانه',
    summary: 'هدفِ کوچک و قابلِ‌دستیابی، حسِ موفقیت می‌سازد.',
    points: [
      'با هم یک هدفِ کوچک بگذارید؛ مثلاً «هر روز یک بازی تا آخرِ هفته».',
      'روی تقویم یا کاغذ، هر روزِ موفق را علامت بزنید؛ دیدنِ پیشرفت انگیزه می‌دهد.',
      'آخرِ هفته با یک جشنِ کوچک یا وقتِ بازیِ مشترک، تلاشش را ببینید.',
    ],
  },
];

export function LearnView() {
  const [open, setOpen] = useState<string | null>(LESSONS[0].id);
  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <h2>همراهیِ فرزند در یادگیری</h2>
        <p>درس‌های کوتاه و عملی؛ هر کدام در کمتر از یک دقیقه خوانده می‌شود و همین امروز قابلِ‌انجام است.</p>
      </section>

      <div className={styles.list}>
        {LESSONS.map((lesson) => {
          const Icon = lesson.icon;
          const expanded = open === lesson.id;
          return (
            <article key={lesson.id} className={styles.lesson} data-open={expanded || undefined}>
              <button type="button" className={styles.head} aria-expanded={expanded}
                aria-controls={`lesson-${lesson.id}`} onClick={() => setOpen(expanded ? null : lesson.id)}>
                <span className={styles.icon} aria-hidden><Icon /></span>
                <span className={styles.titles}>
                  <b>{lesson.title}</b>
                  <small>{lesson.summary}</small>
                </span>
                <HiOutlineChevronDown className={styles.chev} aria-hidden />
              </button>
              <div id={`lesson-${lesson.id}`} className={styles.body} hidden={!expanded}>
                <ul>
                  {lesson.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <p className={styles.more}>درس‌های تازه به‌زودی؛ همین‌جا اضافه می‌شوند.</p>
    </div>
  );
}
