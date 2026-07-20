import { useNavigate } from 'react-router-dom';
import { HiOutlinePlayCircle } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { todayTrafficRule } from '../../trafficRules';
import styles from './TrafficRuleCard.module.css';

/**
 * قانونِ امروز جاده — به روایت سروان راه.
 * هر قانون قرار است بازیِ عملیِ خودش را داشته باشد؛ دکمه به آن بازی می‌رود.
 */
export function TrafficRuleCard() {
  const navigate = useNavigate();
  const officer = LUKORIANS.traffic;
  const rule = todayTrafficRule();

  return (
    <section className={styles.card} aria-label="قانون امروز جاده">
      <div className={styles.stripe} aria-hidden />

      <div className={styles.head}>
        <img className={styles.character} src={officer.image} alt={officer.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>
            <span className={styles.badge} aria-hidden />
            {officer.name}، {officer.role}
          </p>
          <p className={styles.kicker}>قانونِ امروزِ جاده</p>
          <p className={styles.rule}>{rule.text}</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <button
        type="button"
        className={styles.gameBtn}
        onClick={() => navigate(`/traffic-game/${rule.id}`)}
      >
        <HiOutlinePlayCircle aria-hidden />
        بریم این قانون رو بازی کنیم!
      </button>

      <div className={styles.zebra} aria-hidden />
    </section>
  );
}
