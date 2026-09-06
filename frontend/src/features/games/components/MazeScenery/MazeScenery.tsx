import type { ReactElement } from 'react';
import type { DecorKind } from '../../seasonData';
import type { DecorPoint } from '../../useSeasonMap';
import styles from './MazeScenery.module.css';

interface Props {
  decor: DecorPoint[];
}

/**
 * شکل‌های تزئینی. همه inline SVG‌اند نه تصویر: چند ده عنصرِ کوچک‌اند و
 * هر کدام یک درخواستِ شبکه می‌شدند، ضمن اینکه این‌طور رنگشان از تمِ سیزن
 * می‌آید نه از فایل.
 */
const SHAPES: Record<DecorKind, ReactElement> = {
  star: (
    <path d="M12 2.5l2.4 6.3 6.6.4-5.1 4.2 1.7 6.4L12 16.2 6.4 19.8l1.7-6.4L3 9.2l6.6-.4L12 2.5Z" />
  ),
  planet: (
    <>
      <circle cx="12" cy="11" r="6.4" />
      <ellipse cx="12" cy="12.5" rx="10.5" ry="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  comet: (
    <>
      <circle cx="16.5" cy="7.5" r="3.4" />
      <path d="M14 10L4 20l3-9.5L14 10Z" opacity="0.55" />
    </>
  ),
  crystal: <path d="M12 2l6 7-6 13-6-13 6-7Z" />,
  sprout: (
    <>
      <path d="M12 21v-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 13c0-4 3-6 6-6 0 4-3 6-6 6ZM12 15c0-3-2.5-4.5-5-4.5 0 3 2.5 4.5 5 4.5Z" />
    </>
  ),
  cloud: (
    <path d="M6 18c-2.2 0-4-1.6-4-3.6 0-1.8 1.4-3.3 3.2-3.5C5.8 8.9 7.7 7.5 10 7.5c1.9 0 3.6 1 4.4 2.6.6-.4 1.3-.6 2-.6 2 0 3.6 1.5 3.8 3.4 1.8.2 3.2 1.7 3.2 3.5 0 1-.5 1.6-.5 1.6H6Z" />
  ),
};

/**
 * محیطِ اطرافِ مسیر.
 *
 * کلِ لایه `pointer-events: none` است و `aria-hidden` — تزئین نباید نه
 * جلوی کلیکِ گره‌ها را بگیرد نه در صفحه‌خوان خوانده شود. جای هر عنصر از
 * هندسه می‌آید (قطعی و پایدار)، پس این کامپوننت فقط رسم می‌کند.
 */
export function MazeScenery({ decor }: Props) {
  return (
    <div className={styles.layer} aria-hidden>
      {decor.map((item, i) => (
        <svg
          key={i}
          className={`${styles.item} ${styles[item.kind]}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          focusable="false"
          style={{
            left: item.x,
            top: item.y,
            scale: String(item.scale),
            animationDelay: `${item.delay}ms`,
          }}
        >
          {SHAPES[item.kind]}
        </svg>
      ))}
    </div>
  );
}
