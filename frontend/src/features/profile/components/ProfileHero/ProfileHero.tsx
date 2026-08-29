import { HiOutlineTrophy } from 'react-icons/hi2';
import type { User } from '@/types/user';
import { SHOP_ITEMS } from '@/features/club/clubData';
import styles from './ProfileHero.module.css';

interface Props {
  user: User | null;
  /** شناسه‌ی کالاهای خریداری‌شده — نشان‌ها همین‌جا دیده می‌شوند */
  ownedIds?: string[];
}

export function ProfileHero({ user, ownedIds = [] }: Props) {
  // حسابِ بدونِ نام (ساخته‌شده پیش از جریانِ تازه) نباید سربرگِ خالی بدهد
  const name = (user ? `${user.firstName} ${user.lastName}`.trim() : '') || 'دوست لوکو';

  // نشانی که از فروشگاهِ لوکو خریده شده، اینجا می‌نشیند — وگرنه خرید
  // هیچ اثرِ دیدنی‌ای نداشت.
  const badges = SHOP_ITEMS.filter((item) => item.kind === 'badge' && ownedIds.includes(item.id));

  return (
    <header className={styles.hero}>
      <span className={styles.avatar} aria-hidden>
        {name.charAt(0)}
      </span>
      <div className={styles.texts}>
        <p className={styles.kicker}>پروفایل</p>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.role}>شهروند شهر لوکو</p>

        {badges.length > 0 && (
          <ul className={styles.badges} aria-label="نشان‌های تو">
            {badges.map((badge) => (
              <li key={badge.id} className={styles.badge}>
                <HiOutlineTrophy aria-hidden />
                {badge.badgeLabel}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
