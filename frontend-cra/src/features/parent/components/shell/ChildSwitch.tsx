import type { Child } from '../../types';
import styles from './ChildSwitch.module.css';

interface Props {
  /** نامش عمداً children نیست تا با propِ ویژه‌ی ری‌اکت قاطی نشود */
  items: Child[];
  activeId?: string;
  onChange: (id: string) => void;
}

const GRADES = ['', 'پایه اول', 'پایه دوم', 'پایه سوم', 'پایه چهارم', 'پایه پنجم', 'پایه ششم'];

/** سوییچِ فرزند — بالای همه‌ی ویوهای گزارشی */
export function ChildSwitch({ items, activeId, onChange }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={styles.seg} role="tablist" aria-label="انتخاب فرزند">
      {items.map((child) => {
        const active = child.id === activeId;
        const name = `${child.firstName} ${child.lastName}`.trim() || 'بدون نام';
        return (
          <button
            key={child.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? styles.btnActive : styles.btn}
            onClick={() => onChange(child.id)}
          >
            <span className={styles.avatar} aria-hidden>
              {name.charAt(0)}
            </span>
            <span className={styles.texts}>
              {name}
              <small>{GRADES[child.grade] ?? `پایه ${child.grade}`}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
