import { TV_CATEGORIES } from '../../types';
import type { TvCategory } from '../../types';
import styles from './CategoryChips.module.css';

interface Props {
  active: TvCategory | 'همه';
  onSelect: (category: TvCategory | 'همه') => void;
}

export function CategoryChips({ active, onSelect }: Props) {
  const all: (TvCategory | 'همه')[] = ['همه', ...TV_CATEGORIES];

  return (
    <div className={styles.row} role="group" aria-label="دسته‌بندی ویدیوها">
      {all.map((category) => (
        <button
          key={category}
          type="button"
          className={`${styles.chip} ${active === category ? styles.active : ''}`}
          onClick={() => onSelect(category)}
          aria-pressed={active === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
