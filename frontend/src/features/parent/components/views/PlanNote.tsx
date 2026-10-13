import { CrownIcon } from '@/components/ui/icons';
import styles from './PlanNote.module.css';

interface Props {
  childName: string;
  lockedGames?: number;
  onUpgrade: () => void;
}

/** بالای «گزارشِ کامل» در پلنِ رایگان: چه چیزی باز است و چه چیزی با اشتراک می‌آید */
export function PlanNote({ childName, lockedGames = 0, onUpgrade }: Props) {
  return (
    <div className={styles.note}>
      <span className={styles.icon} aria-hidden><CrownIcon size={18} strokeWidth={2} /></span>
      <p>
        <b>گزارشِ ریاضیِ {childName} کامل است.</b>{' '}
        آمارِ درس‌های دیگر
        {lockedGames > 0 && <> و {lockedGames.toLocaleString('fa-IR')} بازیِ دیگرش</>} با اشتراک باز می‌شود.
      </p>
      <button type="button" onClick={onUpgrade}>دیدنِ پلن‌ها</button>
    </div>
  );
}
