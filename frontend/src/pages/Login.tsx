import { LUKORIANS } from '@/lib/characters';
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm';
import styles from './Login.module.css';

export default function Login() {
  const guide = LUKORIANS.welcome;

  return (
    <main className={styles.page}>
      <div className={styles.intro}>
        <div className={styles.bubble}>
          <p className={styles.speaker}>{guide.name}، {guide.role}</p>
          <p className={styles.text}>سلام! به شهر لوکو خوش اومدی. بیا بریم تو!</p>
          <span className={styles.tail} aria-hidden />
        </div>
        <img className={styles.character} src={guide.image} alt={guide.name} />
      </div>
      <LoginForm />
    </main>
  );
}
