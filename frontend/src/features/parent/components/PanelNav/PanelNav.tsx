import type { ComponentType } from 'react';
import {
  HiOutlineChartBar,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCog6Tooth,
  HiOutlineHeart,
  HiOutlinePuzzlePiece,
} from 'react-icons/hi2';
import styles from './PanelNav.module.css';

export type PanelView = 'dashboard' | 'games' | 'wellbeing' | 'support' | 'settings';

interface NavItem {
  key: PanelView;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** هنوز ساخته نشده */
  soon?: boolean;
}

const ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'داشبورد', icon: HiOutlineChartBar },
  { key: 'games', label: 'گزارش بازی‌ها', icon: HiOutlinePuzzlePiece },
  { key: 'wellbeing', label: 'سلامت و روحیه', icon: HiOutlineHeart },
  { key: 'support', label: 'پشتیبانی', icon: HiOutlineChatBubbleLeftRight, soon: true },
  { key: 'settings', label: 'تنظیمات', icon: HiOutlineCog6Tooth, soon: true },
];

interface Props {
  active: PanelView;
  onChange: (view: PanelView) => void;
}

/** منوی پنل — ستون کنار در دسکتاپ، نوارِ افقی در موبایل */
export function PanelNav({ active, onChange }: Props) {
  return (
    <nav className={styles.nav} aria-label="بخش‌های پنل">
      <p className={styles.caption}>گزارش‌ها</p>
      <ul className={styles.list}>
        {ITEMS.map(({ key, label, icon: Icon, soon }) => (
          <li key={key}>
            <button
              type="button"
              className={key === active ? styles.itemActive : styles.item}
              onClick={() => onChange(key)}
              aria-current={key === active ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden />
              <span className={styles.label}>{label}</span>
              {soon && <span className={styles.soon}>به‌زودی</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
