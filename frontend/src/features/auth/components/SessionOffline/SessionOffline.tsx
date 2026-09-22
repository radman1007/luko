import { HiOutlineArrowPath, HiOutlineSignalSlash } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import styles from './SessionOffline.module.css';

interface Props {
  onRetry: () => void;
}

/**
 * نشست باز است ولی اپ بی‌اینترنت و بی‌کاربرِ ذخیره‌شده بالا آمده (فقط بارِ
 * اولِ بعد از به‌روزرسانی ممکن است). به‌جای صفحه‌ی ورود — که یعنی «حسابت
 * رفت» — می‌گوید منتظرِ اینترنت است؛ با برگشتنِ اینترنت خودش ادامه می‌دهد.
 */
export function SessionOffline({ onRetry }: Props) {
  const host = LUKORIANS.navigator;

  return (
    <main className={styles.page} role="status">
      <img className={styles.host} src={host.image} alt={host.name} />
      <span className={styles.badge} aria-hidden>
        <HiOutlineSignalSlash />
      </span>
      <h1 className={styles.title}>اینترنت وصل نیست</h1>
      <p className={styles.text}>
        حسابت سرِ جاشه! فقط این بارِ اول باید یه لحظه اینترنت وصل باشه تا {host.name} بشناسدت.
        از این به بعد بی‌اینترنت هم می‌تونی بازی کنی.
      </p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        <HiOutlineArrowPath aria-hidden />
        دوباره امتحان کن
      </button>
    </main>
  );
}
