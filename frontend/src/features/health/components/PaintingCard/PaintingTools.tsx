import { HiOutlineCheck, HiOutlineTrash } from 'react-icons/hi2';
import { EraserIcon } from '@/components/ui/icons';
import { BRUSH_SIZES, COLORS, eraserWidth } from '../../paintingData';
import styles from './PaintingCard.module.css';

export type PaintTool = 'pen' | 'eraser';

interface Props {
  color: string;
  brush: number;
  tool: PaintTool;
  isEmpty: boolean;
  onColor: (color: string) => void;
  onBrush: (size: number) => void;
  onTool: (tool: PaintTool) => void;
  onClear: () => void;
  onSave: () => void;
}

/**
 * رنگ‌ها، قلم‌ها، پاک‌کن، سطل و «نگهش دار» — در کارت و در بومِ بزرگ یکی است.
 *
 * پاک‌کن فقط جایی را پاک می‌کند که انگشت رویش می‌کشد؛ قبلاً تنها راهِ درست
 * کردنِ یک خطِ اشتباه سطل بود که کلِ نقاشی را می‌برد. اندازه‌اش با همان
 * دکمه‌های قلم عوض می‌شود.
 */
export function PaintingTools({
  color,
  brush,
  tool,
  isEmpty,
  onColor,
  onBrush,
  onTool,
  onClear,
  onSave,
}: Props) {
  const erasing = tool === 'eraser';

  return (
    <div className={styles.tools}>
      <div className={styles.palette} role="group" aria-label="انتخاب رنگ">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${!erasing && c === color ? styles.selected : ''}`}
            style={{ background: c }}
            // رنگ برداشتن یعنی می‌خواهد دوباره بکشد
            onClick={() => {
              onColor(c);
              onTool('pen');
            }}
            aria-label={`رنگ ${c}`}
            aria-pressed={!erasing && c === color}
          />
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.brushes} role="group" aria-label={erasing ? 'اندازه پاک‌کن' : 'اندازه قلم'}>
          {BRUSH_SIZES.map((size) => {
            const dot = erasing ? Math.min(eraserWidth(size) / 2, 22) : size + 4;
            return (
              <button
                key={size}
                type="button"
                className={`${styles.brushBtn} ${size === brush ? styles.brushActive : ''}`}
                onClick={() => onBrush(size)}
                aria-label={erasing ? `پاک‌کن ${size}` : `قلم ${size}`}
                aria-pressed={size === brush}
              >
                <span
                  className={`${styles.brushDot} ${erasing ? styles.eraserDot : ''}`}
                  style={{ width: dot, height: dot, background: erasing ? undefined : color }}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={`${styles.eraserBtn} ${erasing ? styles.eraserOn : ''}`}
          onClick={() => onTool(erasing ? 'pen' : 'eraser')}
          aria-pressed={erasing}
          aria-label={erasing ? 'برگشت به قلم' : 'پاک‌کن'}
        >
          <EraserIcon size={20} aria-hidden />
          <span className={styles.eraserLabel}>پاک‌کن</span>
        </button>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          disabled={isEmpty}
          aria-label="پاک کردنِ همه‌ی نقاشی"
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
