import { HiOutlineCheck, HiOutlineTrash } from 'react-icons/hi2';
import { BRUSH_SIZES, COLORS } from '../../paintingData';
import styles from './PaintingCard.module.css';

interface Props {
  color: string;
  brush: number;
  isEmpty: boolean;
  onColor: (color: string) => void;
  onBrush: (size: number) => void;
  onClear: () => void;
  onSave: () => void;
}

/** رنگ‌ها، قلم‌ها، پاک‌کن و «نگهش دار» — در کارت و در بومِ بزرگ یکی است */
export function PaintingTools({ color, brush, isEmpty, onColor, onBrush, onClear, onSave }: Props) {
  return (
    <div className={styles.tools}>
      <div className={styles.palette} role="group" aria-label="انتخاب رنگ">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${c === color ? styles.selected : ''}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            aria-label={`رنگ ${c}`}
            aria-pressed={c === color}
          />
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.brushes} role="group" aria-label="اندازه قلم">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`${styles.brushBtn} ${size === brush ? styles.brushActive : ''}`}
              onClick={() => onBrush(size)}
              aria-label={`قلم ${size}`}
              aria-pressed={size === brush}
            >
              <span
                className={styles.brushDot}
                style={{ width: size + 4, height: size + 4, background: color }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          disabled={isEmpty}
          aria-label="پاک کردن بوم"
        >
          <HiOutlineTrash />
        </button>

        <button type="button" className={styles.saveBtn} onClick={onSave} disabled={isEmpty}>
          <HiOutlineCheck aria-hidden />
          تمومه، نگهش دار!
        </button>
      </div>
    </div>
  );
}
