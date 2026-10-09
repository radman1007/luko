import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2';
import { faNum } from '../../lib/format';
import styles from './Pagination.module.css';

interface Props {
  page: number;
  pages: number;
  count: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pages, count, onChange }: Props) {
  return (
    <nav className={styles.bar} aria-label="صفحه‌ها">
      <span className={styles.count}>{faNum(count)} مورد</span>
      {pages > 1 && (
        <div className={styles.pager}>
          <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="صفحه‌ی قبل">
            <HiOutlineChevronRight aria-hidden />
          </button>
          <span>
            صفحه‌ی {faNum(page)} از {faNum(pages)}
          </span>
          <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="صفحه‌ی بعد">
            <HiOutlineChevronLeft aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
