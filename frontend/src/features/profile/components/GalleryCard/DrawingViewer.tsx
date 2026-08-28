import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineTrash, HiOutlineXMark } from 'react-icons/hi2';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { drawingsApi } from '@/features/health/api';
import type { Drawing } from '@/features/health/api';
import { useDeleteDrawing } from '@/features/health/useDrawings';
import styles from './DrawingViewer.module.css';

interface Props {
  drawing: Drawing;
  onClose: () => void;
}

const MOOD_LABEL: Record<string, string> = {
  happy: 'خوشحال بودم',
  calm: 'آروم بودم',
  tired: 'خسته بودم',
  sad: 'ناراحت بودم',
  angry: 'عصبانی بودم',
};

/** نمایشِ یک نقاشی در اندازه‌ی کامل + حذف با تأیید */
export function DrawingViewer({ drawing, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteDrawing();
  useEscapeKey(onClose);

  // تصویرِ کامل فقط همین حالا گرفته می‌شود؛ در فهرست نمی‌آید
  const full = useQuery({
    queryKey: ['health', 'drawing-image', drawing.id],
    queryFn: () => drawingsApi.image(drawing.id),
    staleTime: 5 * 60_000,
  });

  const handleDelete = () => {
    remove.mutate(drawing.id, { onSuccess: onClose });
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="نقاشی">
      <div className={styles.card}>
        <header className={styles.top}>
          <span className={styles.when}>{drawing.when}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="بستن">
            <HiOutlineXMark />
          </button>
        </header>

        <div className={styles.canvas}>
          {/* تا رسیدنِ نسخه‌ی کامل، همان بندانگشتی محو نشان داده می‌شود */}
          <img
            className={full.data ? styles.image : styles.imageLoading}
            src={full.data ?? drawing.thumbnail}
            alt={`نقاشیِ ${drawing.when}`}
          />
        </div>

        {drawing.mood && MOOD_LABEL[drawing.mood] && (
          <p className={styles.mood}>وقتی این رو کشیدی، {MOOD_LABEL[drawing.mood]}</p>
        )}

        {confirming ? (
          <div className={styles.confirm}>
            <p className={styles.confirmText}>این نقاشی برای همیشه پاک می‌شه. مطمئنی؟</p>
            <div className={styles.confirmRow}>
              <button
                type="button"
                className={styles.danger}
                onClick={handleDelete}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'در حال پاک کردن…' : 'آره، پاکش کن'}
              </button>
              <button type="button" className={styles.ghost} onClick={() => setConfirming(false)}>
                نه، بمونه
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.deleteBtn} onClick={() => setConfirming(true)}>
            <HiOutlineTrash aria-hidden />
            پاک کردنِ نقاشی
          </button>
        )}
      </div>
    </div>
  );
}
