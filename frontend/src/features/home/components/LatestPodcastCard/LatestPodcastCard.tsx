import { useNavigate } from 'react-router-dom';
import { HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { MOCK_EPISODES } from '@/features/podcast/podcastData';
import { usePlayer } from '@/features/podcast/usePlayer';
import styles from './LatestPodcastCard.module.css';

const LATEST = [MOCK_EPISODES[0]]; // TODO: از podcastService.getLatest

/** تازه‌ترین قسمت پادکست — همین‌جا قابل پخش است */
export function LatestPodcastCard() {
  const navigate = useNavigate();
  const host = LUKORIANS.podcast;
  const player = usePlayer(LATEST);
  const episode = player.current;

  return (
    <section className={styles.card} aria-label="لوکو پادکست">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>لوکو پادکست</h2>
        <span className={styles.hostBadge}>با {host.name}</span>
      </div>
      <p className={styles.desc}>قصه و ماجرا برای گوش‌هات؛ همین‌جا گوش بده!</p>

      <div className={styles.player}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={player.toggle}
          aria-label={player.playing ? 'توقف' : 'پخش'}
        >
          {player.playing ? <HiOutlinePause /> : <HiOutlinePlay />}
        </button>
        <div className={styles.info}>
          <span className={styles.episodeTitle}>{episode.title}</span>
          <div
            className={styles.track}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(player.progress * 100)}
          >
            <span className={styles.fill} style={{ width: `${player.progress * 100}%` }} />
          </div>
        </div>
        <span className={`${styles.wave} ${player.playing ? '' : styles.frozen}`} aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={styles.waveBar} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>

      <button type="button" className={styles.cta} onClick={() => navigate('/luko-podcast')}>
        همه‌ی قسمت‌ها
      </button>
    </section>
  );
}
