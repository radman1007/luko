import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import styles from './SearchBar.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <HiOutlineMagnifyingGlass className={styles.icon} aria-hidden />
      <input
        className={styles.input}
        type="search"
        placeholder="دنبال چه ویدیویی می‌گردی؟"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="جستجوی ویدیو"
      />
    </div>
  );
}
