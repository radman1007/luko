import { useEffect, useRef, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineChartBarSquare,
  HiOutlineCog6Tooth,
  HiOutlineHeart,
  HiOutlinePuzzlePiece,
} from 'react-icons/hi2';
import { GamepadIcon } from '@/components/ui/icons';
import styles from './BottomNav.module.css';

export type PanelTab = 'dashboard' | 'reports' | 'daily' | 'health' | 'settings';

interface Props {
  tab: PanelTab;
  onChange: (tab: PanelTab) => void;
}

type TabIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const TABS: { key: PanelTab; label: string; icon: TabIcon; fab?: boolean }[] = [
  { key: 'dashboard', label: 'داشبورد', icon: HiOutlineChartBarSquare },
  { key: 'reports', label: 'گزارش‌ها', icon: HiOutlinePuzzlePiece },
  { key: 'daily', label: 'بازی روز', icon: GamepadIcon, fab: true },
  { key: 'health', label: 'سلامت', icon: HiOutlineHeart },
  { key: 'settings', label: 'تنظیمات', icon: HiOutlineCog6Tooth },
];

/** نویگیشنِ پایین با گلایدرِ لغزان و دکمه‌ی وسطِ برجسته */
export function BottomNav({ tab, onChange }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const [glider, setGlider] = useState<{ width: number; x: number } | null>(null);

  useEffect(() => {
    const move = () => {
      const nav = navRef.current;
      const button = nav?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
      if (!nav || !button) return;
      if (tab === 'daily') {
        setGlider(null);
        return;
      }
      const rect = button.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setGlider({ width: rect.width - 6, x: rect.left - navRect.left + 3 });
    };

    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [tab]);

  return (
    <nav ref={navRef} className={styles.nav} aria-label="بخش‌های پنل">
      <span
        className={styles.glider}
        aria-hidden
        style={
          glider
            ? { width: `${glider.width}px`, transform: `translateX(${glider.x}px)`, opacity: 1 }
            : { opacity: 0 }
        }
      />
      {TABS.map(({ key, label, icon: Icon, fab }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            data-tab={key}
            className={`${fab ? styles.fabItem : styles.item} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(key)}
          >
            <span className={fab ? styles.fabCircle : styles.icon}>
              <Icon aria-hidden />
            </span>
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
