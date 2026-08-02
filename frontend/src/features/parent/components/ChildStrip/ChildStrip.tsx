import { HiOutlineClock, HiOutlinePlus } from 'react-icons/hi2';
import type { Child } from '../../types';
import styles from './ChildStrip.module.css';

interface Props {
  items: Child[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const GRADE_LABEL = ['', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];

/** انتخاب فرزند — همه‌ی گزارش‌های پنل به فرزندِ انتخاب‌شده وصل‌اند */
export function ChildStrip({ items, selectedId, onSelect }: Props) {
  return (
    <div className={styles.strip}>
      {items.map((child) => {
        const selected = child.id === selectedId;
        return (
          <button
            key={child.id}
            type="button"
            className={selected ? styles.cardActive : styles.card}
            onClick={() => onSelect(child.id)}
            aria-pressed={selected}
          >
            <span className={styles.avatar} aria-hidden>
              {child.firstName[0]}
              {child.online && <i className={styles.online} />}
            </span>
            <span className={styles.info}>
              <b className={styles.name}>
                {child.firstName} {child.lastName}
              </b>
              <span className={styles.meta}>
                پایهٔ {GRADE_LABEL[child.grade] ?? child.grade}
                {child.school ? ` — ${child.school}` : ''}
              </span>
              <span className={styles.last}>
                <HiOutlineClock size={13} aria-hidden />
                {child.online ? 'همین حالا آنلاین است' : `آخرین فعالیت: ${child.lastActiveAt}`}
              </span>
            </span>
          </button>
        );
      })}

      <button type="button" className={styles.add} disabled>
        <HiOutlinePlus size={18} aria-hidden />
        <span>افزودن فرزند</span>
        <span className={styles.soon}>به‌زودی</span>
      </button>
    </div>
  );
}
