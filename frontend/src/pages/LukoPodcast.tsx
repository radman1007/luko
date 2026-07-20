import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { PodcastHero } from '@/features/podcast/components/PodcastHero/PodcastHero';
import { PlayerCard } from '@/features/podcast/components/PlayerCard/PlayerCard';
import { EpisodeList } from '@/features/podcast/components/EpisodeList/EpisodeList';
import { MOCK_EPISODES } from '@/features/podcast/podcastData';
import { usePlayer } from '@/features/podcast/usePlayer';
import styles from './LukoPodcast.module.css';

const GUIDE_STEPS = [
  'سلام! من آوام؛ صدای شهر لوکو از همین اتاق پخش می‌شه!',
  'هر روز یه قصه یا ماجرای تازه برات ضبط می‌کنم؛ دیسک رو بزن تا بچرخه!',
  'هر قسمتی رو تا آخر گوش بدی، کنارش تیک سبز می‌خوره. بزن بریم!',
];

export default function LukoPodcast() {
  const player = usePlayer(MOCK_EPISODES);

  return (
    <StudentLayout className={styles.page}>
      <PodcastHero />
      <PlayerCard
        episode={player.current}
        playing={player.playing}
        elapsed={player.elapsed}
        progress={player.progress}
        onToggle={player.toggle}
      />
      <EpisodeList
        episodes={MOCK_EPISODES}
        currentId={player.current.id}
        playing={player.playing}
        listenedIds={player.listened}
        onSelect={player.select}
      />

      <CharacterGuide character={LUKORIANS.podcast} steps={GUIDE_STEPS} storageKey="podcast-intro" />
    </StudentLayout>
  );
}
