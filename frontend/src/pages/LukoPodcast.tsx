import { HiOutlineArrowPath, HiOutlineMicrophone, HiOutlineSignalSlash } from 'react-icons/hi2';
import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { Board, Column } from '@/components/layout/Board/Board';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { PodcastHero } from '@/features/podcast/components/PodcastHero/PodcastHero';
import { PlayerCard } from '@/features/podcast/components/PlayerCard/PlayerCard';
import { EpisodeList } from '@/features/podcast/components/EpisodeList/EpisodeList';
import { usePlayer } from '@/features/podcast/usePlayer';
import { usePodcasts } from '@/features/podcast/usePodcasts';
import styles from './LukoPodcast.module.css';

const GUIDE_STEPS = [
  'سلام! من آوام؛ صدای شهر لوکو از همین اتاق پخش می‌شه!',
  'هر روز یه قصه یا ماجرای تازه برات ضبط می‌کنم؛ دیسک رو بزن تا بچرخه!',
  'هر قسمتی رو تا آخر گوش بدی، کنارش تیک سبز می‌خوره. بزن بریم!',
];

export default function LukoPodcast() {
  const podcasts = usePodcasts();
  const player = usePlayer(podcasts.episodes);
  const current = player.current;

  return (
    <StudentLayout className={styles.page}>
      <PodcastHero />
      {podcasts.isLoading ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="در حالِ آوردنِ قسمت‌ها">
          <span className={styles.skelPlayer} />
          <span className={styles.skelRow} />
          <span className={styles.skelRow} />
        </div>
      ) : podcasts.isError ? (
        <section className={styles.state} role="alert">
          <span className={styles.stateIcon} aria-hidden>
            <HiOutlineSignalSlash />
          </span>
          <h2 className={styles.stateTitle}>قسمت‌ها نیامدند</h2>
          <p className={styles.stateText}>اینترنت را نگاه کن و دوباره امتحان کن.</p>
          <button type="button" className={styles.stateBtn} onClick={() => podcasts.refetch()}>
            <HiOutlineArrowPath aria-hidden />
            دوباره
          </button>
        </section>
      ) : !current ? (
        <section className={styles.state}>
          <span className={styles.stateIcon} aria-hidden>
            <HiOutlineMicrophone />
          </span>
          <h2 className={styles.stateTitle}>آوا دارد قسمتِ تازه ضبط می‌کند</h2>
          <p className={styles.stateText}>به‌زودی اولین قسمت همین‌جا می‌رسد؛ سر بزن!</p>
        </section>
      ) : (
        <Board>
          {/* روی تبلت پخش‌کننده کنارِ فهرست می‌ماند و با اسکرول جا نمی‌ماند */}
          <Column side="start" className={styles.playerCol}>
            <PlayerCard
              episode={current}
              playing={player.playing}
              elapsed={player.elapsed}
              duration={player.duration}
              progress={player.progress}
              buffering={player.buffering}
              error={player.error}
              onToggle={player.toggle}
              onSeek={player.seek}
            />
          </Column>
          <Column side="end">
            <EpisodeList
              episodes={podcasts.episodes}
              currentId={current.id}
              playing={player.playing}
              listenedIds={player.listened}
              onSelect={player.select}
            />
          </Column>
        </Board>
      )}

      <CharacterGuide character={LUKORIANS.podcast} steps={GUIDE_STEPS} storageKey="podcast-intro" />
    </StudentLayout>
  );
}
