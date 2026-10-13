import { MoodFaceIcon } from '@/components/ui/icons';
import type { MoodVariant } from '@/components/ui/icons';
import { MOOD_LOOK, fa } from './moods';
import styles from './MoodMix.module.css';

interface Props {
  mix: { mood: MoodVariant; count: number }[];
}

/** ترکیبِ حال‌های هفته: یک نوار با بخشِ هر حال + راهنما با صورتک، نام و تعداد (رنگ تنها نشانه نیست) */
export function MoodMix({ mix }: Props) {
  const total = mix.reduce((sum, item) => sum + item.count, 0);
  const summary = mix.map((item) => `${MOOD_LOOK[item.mood].label} ${fa(item.count)}`).join('، ');
  return (
    <div className={styles.mix}>
      <div className={styles.bar} role="img" aria-label={`ترکیبِ حال‌ها از ${fa(total)} بار: ${summary}`}>
        {mix.map((item) => (
          <i key={item.mood} style={{ flexGrow: item.count, background: MOOD_LOOK[item.mood].color }}
            title={`${MOOD_LOOK[item.mood].label}: ${fa(item.count)} بار`} />
        ))}
      </div>
      <ul className={styles.legend} aria-hidden>
        {mix.map((item) => (
          <li key={item.mood} style={{ color: MOOD_LOOK[item.mood].color }}>
            <MoodFaceIcon variant={item.mood} size={15} />
            <span>{MOOD_LOOK[item.mood].label}</span>
            <b>{fa(item.count)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
