import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBellAlert,
  HiOutlineLockClosed,
  HiOutlineMusicalNote,
  HiOutlineSpeakerWave,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { useAuth } from '@/features/auth/context';
import { LUKORIANS } from '@/lib/characters';
import { useSettings } from '../../useSettings';
import type { KidSettings } from '../../useSettings';
import styles from './SettingsCard.module.css';

const TOGGLES: { key: keyof KidSettings; label: string; icon: React.ComponentType }[] = [
  { key: 'sound', label: 'صدای افکت‌ها', icon: HiOutlineSpeakerWave },
  { key: 'music', label: 'موسیقی پس‌زمینه', icon: HiOutlineMusicalNote },
  { key: 'moodReminder', label: 'یادآور ثبت حال', icon: HiOutlineBellAlert },
];

export function SettingsCard() {
  const maker = LUKORIANS.maker;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { settings, toggle, resetGuides } = useSettings();
  const [guidesReset, setGuidesReset] = useState(false);

  const handleResetGuides = () => {
    resetGuides();
    setGuidesReset(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <section className={styles.card} aria-label="تنظیمات">
      <div className={styles.head}>
        <img className={styles.character} src={maker.image} alt={maker.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{maker.name}، {maker.role}</p>
          <p className={styles.bubbleText}>
            سلام! پیچ‌ومهره‌های اینجا دست منه؛ تنظیماتت رو هر جور می‌خوای سفت و شل کن!
          </p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>
      <h2 className={styles.title}>تنظیمات</h2>

      <ul className={styles.list}>
        {TOGGLES.map(({ key, label, icon: Icon }) => (
          <li key={key} className={styles.row}>
            <span className={styles.rowIcon} aria-hidden>
              <Icon />
            </span>
            <span className={styles.rowLabel}>{label}</span>
            <button
              type="button"
              className={`${styles.switch} ${settings[key] ? styles.on : ''}`}
              onClick={() => toggle(key)}
              role="switch"
              aria-checked={settings[key]}
              aria-label={label}
            >
              <span className={styles.knob} />
            </button>
          </li>
        ))}

        <li className={styles.row}>
          <span className={styles.rowIcon} aria-hidden>
            <HiOutlineSparkles />
          </span>
          <span className={styles.rowLabel}>راهنمای کاراکترها</span>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={handleResetGuides}
            disabled={guidesReset}
          >
            {guidesReset ? 'برگشتن!' : 'دوباره نشون بده'}
          </button>
        </li>

        <li className={`${styles.row} ${styles.lockedRow}`}>
          <span className={styles.rowIcon} aria-hidden>
            <HiOutlineLockClosed />
          </span>
          <span className={styles.rowLabel}>تغییر رمز و مشخصات</span>
          <span className={styles.lockedNote}>فقط از پنل والدین</span>
        </li>
      </ul>

      <button type="button" className={styles.logout} onClick={handleLogout}>
        <HiOutlineArrowRightOnRectangle aria-hidden />
        خروج از حساب
      </button>
    </section>
  );
}
