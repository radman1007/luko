import type { ComponentType, ReactNode, SVGProps } from 'react';
import styles from './CardHead.module.css';

interface Props {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  note?: ReactNode;
  tone?: 'teal' | 'sun' | 'rose' | 'violet';
}

/** سرِ کارت‌های سلامت: نشانِ گرد، عنوان و یک خط توضیح — هم‌شکلِ کارت‌های خانه */
export function CardHead({ id, icon: Icon, title, note, tone = 'teal' }: Props) {
  return (
    <header className={styles.head}>
      <span className={styles.badge} data-tone={tone} aria-hidden><Icon /></span>
      <div>
        <h3 id={id}>{title}</h3>
        {note && <p>{note}</p>}
      </div>
    </header>
  );
}
