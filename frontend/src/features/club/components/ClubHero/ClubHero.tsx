import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import styles from './ClubHero.module.css';

interface Props {
  coins: number;
}

export function ClubHero({ coins }: Props) {
  const coach = LUKORIANS.club;

  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>لوکو کلاب</p>
        <h1 className={styles.name}>{coach.name}</h1>
        <p className={styles.role}>{coach.role}</p>
        <p className={styles.coins}>
          <CoinIcon size={18} aria-hidden />
          {coins.toLocaleString('fa-IR')} سکه
        </p>
      </div>
      <img className={styles.character} src={coach.image} alt={coach.name} />
    </header>
  );
}
