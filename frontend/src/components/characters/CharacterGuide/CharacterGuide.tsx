import { useState } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import type { Lukorian } from '@/lib/characters';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import styles from './CharacterGuide.module.css';

interface Props {
  character: Lukorian;
  /** جمله‌هایی که کاراکتر قدم‌به‌قدم می‌گوید */
  steps: string[];
  /** کلید یکتا؛ راهنما برای هر کلید فقط یک بار نمایش داده می‌شود */
  storageKey: string;
}

const SEEN_PREFIX = 'luko_guide_';

/**
 * راهنمای کمیک‌بوکی: کاراکتر بخش، مثل بازی‌ها ظاهر می‌شود،
 * چند جمله در حباب گفتگو می‌گوید و می‌رود.
 */
export function CharacterGuide({ character, steps, storageKey }: Props) {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(SEEN_PREFIX + storageKey) !== '1',
  );
  const [step, setStep] = useState(0);

  const close = () => {
    localStorage.setItem(SEEN_PREFIX + storageKey, '1');
    setVisible(false);
  };

  useEscapeKey(() => {
    if (visible) close();
  });

  if (!visible || steps.length === 0) return null;

  // clamp تا کلیک‌های خیلی سریع ایندکس را از محدوده رد نکنند
  const current = Math.min(step, steps.length - 1);
  const isLast = current === steps.length - 1;

  const next = () => (isLast ? close() : setStep(current + 1));

  return (
    <div className={styles.overlay}>
      <div className={styles.stage} style={{ '--guide-color': character.theme.primary } as React.CSSProperties}>
        <div className={styles.bubble} key={current}>
          <button type="button" className={styles.close} onClick={close} aria-label="بستن راهنما">
            <HiOutlineXMark />
          </button>
          <p className={styles.speaker}>{character.name}</p>
          <p className={styles.text}>{steps[current]}</p>
          <div className={styles.actions}>
            <span className={styles.dots} aria-hidden>
              {steps.map((_, i) => (
                <i key={i} className={i === current ? styles.dotActive : styles.dot} />
              ))}
            </span>
            <button type="button" className={styles.next} onClick={next}>
              {isLast ? 'باشه، بزن بریم!' : 'بعدی'}
            </button>
          </div>
          <span className={styles.tail} aria-hidden />
        </div>
        <img className={styles.character} src={character.image} alt={character.name} />
      </div>
    </div>
  );
}
