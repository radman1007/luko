import { Link } from 'react-router-dom';
import { HiOutlineChevronLeft } from 'react-icons/hi2';
import styles from './SectionHeader.module.css';

interface Props {
  title: string;
  linkTo?: string;
  linkLabel?: string;
}

export function SectionHeader({ title, linkTo, linkLabel = 'مشاهده همه' }: Props) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      {linkTo && (
        <Link to={linkTo} className={styles.link}>
          {linkLabel}
          <HiOutlineChevronLeft aria-hidden />
        </Link>
      )}
    </div>
  );
}
