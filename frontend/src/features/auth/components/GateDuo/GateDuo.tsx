import { useEffect, useState } from 'react';
import { LUKORIANS } from '@/lib/characters';
import { GATE_LINES, LINE_MS } from '../../gateData';
import styles from './GateDuo.module.css';

/**
 * پری و پویا دمِ دروازه‌ی شهرِ لوکو — بالای فرمِ ورود.
 *
 * حباب به کسی اشاره می‌کند که دارد حرف می‌زند و او کمی بالا می‌پرد. رنگِ
 * حباب هم رنگِ همان کاراکتر است، پس صفحه نه صورتی است نه آبی؛ مالِ هر دوست.
 */
export function GateDuo() {
  const [index, setIndex] = useState(0);
  const last = GATE_LINES.length - 1;

  // یک دور خودش جلو می‌رود و روی جمله‌ی آخر (دعوت به ورود) می‌ایستد
  useEffect(() => {
    if (index >= last) return undefined;
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, last)), LINE_MS);
    return () => window.clearTimeout(id);
  }, [index, last]);

  const line = GATE_LINES[index];
  const pariTalks = line.speaker.id === LUKORIANS.welcome.id;

  return (
    <div className={styles.duo}>
      <button
        type="button"
        className={`${styles.bubble} ${pariTalks ? styles.fromPari : styles.fromPouya}`}
        // رنگِ حباب از تمِ همان کاراکتر در رجیستری می‌آید
        style={
          {
            '--speaker': line.speaker.theme.primary,
            '--speaker-dark': line.speaker.theme.dark,
          } as React.CSSProperties
        }
        onClick={() => setIndex((i) => (i + 1) % GATE_LINES.length)}
      >
        <span className={styles.speaker}>
          {line.speaker.name}، {line.speaker.role}
        </span>
        <span key={index} className={styles.text}>
          {line.text}
        </span>
        <span className={styles.tail} aria-hidden />
      </button>

      <div className={styles.cast}>
        <img
          className={`${styles.pari} ${pariTalks ? styles.talking : ''}`}
          src={LUKORIANS.welcome.image}
          alt={LUKORIANS.welcome.name}
        />
        <img
          className={`${styles.pouya} ${pariTalks ? '' : styles.talking}`}
          src={LUKORIANS.navigator.image}
          alt={LUKORIANS.navigator.name}
        />
      </div>
    </div>
  );
}
