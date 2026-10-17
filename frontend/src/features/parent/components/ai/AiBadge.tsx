import { HiOutlineSparkles } from 'react-icons/hi2';
import type { AiStatus } from '../../types';
import styles from './AiBadge.module.css';

interface Props {
  ai?: AiStatus;
  /** همین بخش را مدل نوشته؟ (بخشی که مدل ردش کرد قاعده‌محور می‌ماند و نشان نمی‌گیرد) */
  written?: boolean;
  /** روی زمینه‌ی تیره (کادرِ گزارشِ هفتگی) */
  onDark?: boolean;
}

/**
 * نشانِ «تحلیلِ هوشمند»: والد بداند این متن را مدلِ زبانی از عددهای همین بچه نوشته و با کدام مدل.
 * وقتی تحلیل در صف است «در حالِ تحلیل…» نشان می‌دهد (گزارش خودش چند ثانیه بعد تازه می‌شود).
 */
export function AiBadge({ ai, written = false, onDark = false }: Props) {
  if (!ai) return null;
  if (ai.status === 'pending') {
    return (
      <span className={styles.badge} data-pending data-dark={onDark || undefined} role="status">
        <i className={styles.pulse} aria-hidden />
        در حالِ تحلیلِ هوشمند…
      </span>
    );
  }
  if (ai.status !== 'ready' || !written) return null;
  const detail = `نوشته‌شده با «${ai.tierLabel ?? 'لوکو'}» از روی عددهای واقعیِ همین گزارش${
    ai.generatedFa ? `، ${ai.generatedFa}` : ''}`;
  return (
    <span className={styles.badge} data-tier={ai.tier} data-dark={onDark || undefined} title={detail}>
      <HiOutlineSparkles aria-hidden />
      تحلیلِ هوشمند
      <span className={styles.hidden}>، {detail}</span>
    </span>
  );
}
