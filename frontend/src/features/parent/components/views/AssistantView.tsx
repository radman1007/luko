import { HiOutlineChatBubbleLeftRight, HiOutlineSparkles } from 'react-icons/hi2';
import styles from './AssistantView.module.css';

interface Props {
  childName: string;
  onSupport: () => void;
  onTips: () => void;
}

/** دستیارِ هوشمند — هنوز آماده نیست؛ صفحه می‌گوید چه خواهد کرد و تا آن موقع چه راهی هست */
export function AssistantView({ childName, onSupport, onTips }: Props) {
  const samples = [
    `${childName} این هفته در چه چیزی بهتر شد؟`,
    'چطور کمکش کنم جمع‌های دو رقمی را بهتر یاد بگیرد؟',
    'چرا بعضی روزها زود از بازی خسته می‌شود؟',
    'برای این هفته چه برنامه‌ای پیشنهاد می‌کنی؟',
  ];
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.icon} aria-hidden><HiOutlineSparkles /></span>
        <span className={styles.soon}>به‌زودی</span>
        <h2>دستیارِ هوشمندِ لوکو</h2>
        <p>
          به‌زودی می‌توانید هر سؤالی درباره‌ی یادگیری و رفتارِ {childName} بپرسید و جوابی بگیرید که از
          بازی‌ها و گزارش‌های خودِ او ساخته شده، نه یک توصیه‌ی کلی.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="assistant-samples">
        <h3 id="assistant-samples">چه چیزهایی می‌شود پرسید؟</h3>
        <ul className={styles.samples}>
          {samples.map((text) => (
            <li key={text}><HiOutlineChatBubbleLeftRight aria-hidden />{text}</li>
          ))}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="assistant-now">
        <h3 id="assistant-now">تا آن موقع</h3>
        <p className={styles.text}>
          «پیشنهادِ این هفته» در خانه از روی بازی‌های {childName} ساخته می‌شود؛ برای هر سؤالِ دیگری هم
          پشتیبانیِ لوکو کنارِ شماست.
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={onTips}>پیشنهادهای این هفته</button>
          <button type="button" className={styles.ghost} onClick={onSupport}>گفتگو با پشتیبانی</button>
        </div>
      </section>
    </div>
  );
}
