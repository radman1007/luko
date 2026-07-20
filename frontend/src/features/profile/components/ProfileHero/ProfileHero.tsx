import type { User } from '@/types/user';
import styles from './ProfileHero.module.css';

interface Props {
  user: User | null;
}

export function ProfileHero({ user }: Props) {
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : 'دوست لوکو';

  return (
    <header className={styles.hero}>
      <span className={styles.avatar} aria-hidden>
        {name.charAt(0)}
      </span>
      <div className={styles.texts}>
        <p className={styles.kicker}>پروفایل</p>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.role}>شهروند شهر لوکو</p>
      </div>
    </header>
  );
}
