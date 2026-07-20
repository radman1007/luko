import { HiOutlineEye, HiOutlineHeart, HiOutlinePlayCircle, HiHeart } from 'react-icons/hi2';
import type { TvVideo } from '../../types';
import styles from './VideoCard.module.css';

interface Props {
  video: TvVideo;
  isLiked: boolean;
  onOpen: (videoId: string) => void;
}

export function VideoCard({ video, isLiked, onOpen }: Props) {
  return (
    <button type="button" className={styles.card} onClick={() => onOpen(video.id)}>
      <span className={styles.thumb} aria-hidden>
        <video.icon className={styles.thumbIcon} />
        <HiOutlinePlayCircle className={styles.play} />
        <span className={styles.duration}>
          {video.durationMinutes.toLocaleString('fa-IR')} دقیقه
        </span>
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{video.title}</span>
        <span className={styles.meta}>
          <span className={styles.category}>{video.category}</span>
          <span className={styles.views}>
            <HiOutlineEye aria-hidden />
            {video.views.toLocaleString('fa-IR')}
          </span>
          <span className={`${styles.like} ${isLiked ? styles.liked : ''}`} aria-hidden>
            {isLiked ? <HiHeart /> : <HiOutlineHeart />}
          </span>
        </span>
      </span>
    </button>
  );
}
