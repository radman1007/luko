import { HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { BrandMark } from '@/components/ui/icons';
import type { User } from '@/types/user';
import styles from './PanelHeader.module.css';

interface Props {
  user: User | null;
  onLogout: () => void;
}

function initials(user: User | null): string {
  const first = user?.firstName?.trim()?.[0] ?? 'و';
  const last = user?.lastName?.trim()?.[0] ?? '';
  return `${first}${last}`;
}

/** نوارِ بالای پنل — هویتِ سرویس در راست، حسابِ والد در چپ */
export function PanelHeader({ user, onLogout }: Props) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'حساب والد';

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          <BrandMark size={20} />
        </span>
        <span className={styles.brandText}>
          <b className={styles.brandName}>لوکو</b>
          <span className={styles.brandSub}>پنل والدین</span>
        </span>
      </div>

      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden>
          {initials(user)}
        </span>
        <span className={styles.accountText}>
          <b className={styles.accountName}>{fullName}</b>
          {user?.phone && (
            <span className={styles.accountMeta} dir="ltr">
              {user.phone}
            </span>
          )}
        </span>
        <button type="button" className={styles.logout} onClick={onLogout}>
          <HiOutlineArrowRightOnRectangle size={17} aria-hidden />
          <span className={styles.logoutText}>خروج</span>
        </button>
      </div>
    </header>
  );
}
