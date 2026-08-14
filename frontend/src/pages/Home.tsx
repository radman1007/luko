import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { useAuth } from '@/features/auth/context';
import { useClub } from '@/features/club/useClub';
import { useGarden } from '@/features/garden/useGarden';
import { MoodModal } from '@/features/health/components/MoodModal/MoodModal';
import { useMoodReminder } from '@/features/health/useMoodReminder';
import { HomeHero } from '@/features/home/components/HomeHero/HomeHero';
import { StatsBar } from '@/features/home/components/StatsBar/StatsBar';
import { DailyGameCard } from '@/features/home/components/DailyGameCard/DailyGameCard';
import { GameZoneCard } from '@/features/home/components/GameZoneCard/GameZoneCard';
import { TodayPathCard } from '@/features/home/components/TodayPathCard/TodayPathCard';
import { LatestPodcastCard } from '@/features/home/components/LatestPodcastCard/LatestPodcastCard';
import { AboutCard } from '@/features/home/components/AboutCard/AboutCard';
import { MOCK_STATS } from '@/features/home/mockData';
import styles from './Home.module.css';

const GUIDE_STEPS = [
  'سلام! من لوکی‌ام، رفیقِ همیشگیِ تو توی این شهر.',
  'هر روز یه «بازی روز» برات می‌ذارم؛ یه ضربه بزنی، مستقیم می‌ری توش.',
  'پایین‌ترش مسیرِ امروزته: چهار تا کار کوچیک که با هم می‌زنیمشون. بریم!',
];

/** آیا این زمان مربوط به همین امروز است؟ */
function isToday(time: number | null | undefined): boolean {
  if (!time) return false;
  const day = new Date(time);
  const now = new Date();
  return (
    day.getFullYear() === now.getFullYear() &&
    day.getMonth() === now.getMonth() &&
    day.getDate() === now.getDate()
  );
}

function moodRecordedToday(): boolean {
  return isToday(Number(localStorage.getItem('luko_last_mood_time')) || null);
}

export default function Home() {
  const { user } = useAuth();
  const mood = useMoodReminder();
  const club = useClub();
  const garden = useGarden();

  return (
    <StudentLayout className={styles.page}>
      <HomeHero name={user?.firstName ?? 'دوست لوکو'} />
      <div className={styles.overlap}>
        <StatsBar coins={club.coins} streak={club.streak} xp={MOCK_STATS.xp} />
      </div>

      <DailyGameCard />
      <GameZoneCard />
      <TodayPathCard
        missionsDone={club.doneToday.length > 0}
        sportDone={club.sportDoneToday.length > 0}
        moodDone={moodRecordedToday()}
        gardenDone={isToday(garden.lastWateredAt)}
        streak={club.streak}
        onMood={mood.open}
      />
      <LatestPodcastCard />
      <AboutCard />

      {mood.show && <MoodModal onSelect={mood.record} onClose={mood.dismiss} />}
      {/* راهنمای لوکی فقط وقتی می‌آید که مودالِ حال جلوی چشم نباشد */}
      {!mood.show && (
        <CharacterGuide character={LUKORIANS.luko} steps={GUIDE_STEPS} storageKey="home-luko" />
      )}
    </StudentLayout>
  );
}
