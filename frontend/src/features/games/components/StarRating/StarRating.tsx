import styles from './StarRating.module.css';

interface Props {
  earned: number;
  max?: number;
  size?: 'sm' | 'md';
  /**
   * نامِ قابلِ خواندن برای صفحه‌خوان. ستاره‌ها فقط رنگ نیستند —
   * وضعیتشان باید بدونِ دیدن هم فهمیده شود.
   */
  label?: string;
}

/**
 * ستاره‌های یک مرحله.
 *
 * ستاره‌ی خالی عمداً حذف نمی‌شود: بچه باید ببیند چقدر جا برای بهتر شدن
 * مانده — همین است که او را برای بازیِ دوباره برمی‌گرداند. تفاوتِ پر و
 * خالی هم فقط رنگ نیست؛ خالی تو‌خالی و کوچک‌تر است تا برای کسی که رنگ را
 * تشخیص نمی‌دهد هم پیدا باشد.
 */
export function StarRating({ earned, max = 3, size = 'sm', label }: Props) {
  const safe = Math.max(0, Math.min(earned, max));

  return (
    <span
      className={`${styles.row} ${size === 'md' ? styles.md : styles.sm}`}
      role="img"
      aria-label={label ?? `${safe.toLocaleString('fa-IR')} از ${max.toLocaleString('fa-IR')} ستاره`}
    >
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className={i < safe ? styles.on : styles.off}
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <path
            d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6Z"
            fill={i < safe ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={i < safe ? 0 : 1.8}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
