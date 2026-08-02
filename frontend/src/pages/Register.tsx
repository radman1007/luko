import { LUKORIANS } from '@/lib/characters';
import { OtpAuthForm } from '@/features/auth/components/OtpAuthForm/OtpAuthForm';
import styles from './Login.module.css';

export default function Register() {
  const guide = LUKORIANS.welcome;

  return (
    <main className={styles.page}>
      <div className={styles.intro}>
        <div className={styles.bubble}>
          <p className={styles.speaker}>{guide.name}، {guide.role}</p>
          <p className={styles.text}>بیا حسابت رو بسازیم تا پیشرفتت همیشه ذخیره بمونه!</p>
          <span className={styles.tail} aria-hidden />
        </div>
        <img className={styles.character} src={guide.image} alt={guide.name} />
      </div>
      <OtpAuthForm mode="register" />
    </main>
  );
}
