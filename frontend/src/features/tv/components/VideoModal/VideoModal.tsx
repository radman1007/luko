import { HiOutlineEye, HiOutlineHeart, HiOutlinePlay, HiOutlineXMark, HiHeart } from 'react-icons/hi2';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { TvVideo } from '../../types';
import styles from './VideoModal.module.css';

interface Props {
  video: TvVideo;
  isLiked: boolean;
  onToggleLike: (videoId: string) => void;
  onClose: () => void;
}

export function VideoModal({ video, isLiked, onToggleLike, onClose }: Props) {
  useEscapeKey(onClose);
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={video.title}>
      <div className={styles.sheet}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="بستن">
          <HiOutlineXMark />
        </button>

        {/* TODO: با آماده شدن بک‌اند، پخش‌کننده‌ی واقعی جایگزین می‌شود */}
        <div className={styles.player} aria-hidden>
          <video.icon className={styles.playerIcon} />
          <span className={styles.playBadge}>
            <HiOutlinePlay />
          </span>
        </div>

        <h2 className={styles.title}>{video.title}</h2>
        <div className={styles.meta}>
          <span className={styles.category}>{video.category}</span>
          <span className={styles.metaItem}>
            {video.durationMinutes.toLocaleString('fa-IR')} دقیقه
          </span>
          <span className={styles.metaItem}>
            <HiOutlineEye aria-hidden />
            {video.views.toLocaleString('fa-IR')} بازدید
          </span>
        </div>

        <button
          type="button"
          className={`${styles.likeBtn} ${isLiked ? styles.liked : ''}`}
          onClick={() => onToggleLike(video.id)}
        >
          {isLiked ? <HiHeart aria-hidden /> : <HiOutlineHeart aria-hidden />}
          {isLiked ? 'دوستش دارم!' : 'قلب بده'}
        </button>
      </div>
    </div>
  );
}
