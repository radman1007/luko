import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { useAuth } from '@/features/auth/context';
import { useClub } from '@/features/club/useClub';
import { MoodModal } from '@/features/health/components/MoodModal/MoodModal';
import { useMoodReminder } from '@/features/health/useMoodReminder';
import { HomeHero } from '@/features/home/components/HomeHero/HomeHero';
import { StatsBar } from '@/features/home/components/StatsBar/StatsBar';
import { TrafficRuleCard } from '@/features/home/components/TrafficRuleCard/TrafficRuleCard';
import { GameZoneCard } from '@/features/home/components/GameZoneCard/GameZoneCard';
import { LatestVideoCard } from '@/features/home/components/LatestVideoCard/LatestVideoCard';
import { LatestPodcastCard } from '@/features/home/components/LatestPodcastCard/LatestPodcastCard';
import { ChefRecipeCard } from '@/features/home/components/ChefRecipeCard/ChefRecipeCard';
import { ClubProgressCard } from '@/features/home/components/ClubProgressCard/ClubProgressCard';
import { CodingTeaser } from '@/features/home/components/CodingTeaser/CodingTeaser';
import { AboutCard } from '@/features/home/components/AboutCard/AboutCard';
import { MOCK_STATS } from '@/features/home/mockData';
import styles from './Home.module.css';

export default function Home() {
  const { user } = useAuth();
  const mood = useMoodReminder();
  const club = useClub();

  return (
    <StudentLayout className={styles.page}>
      <HomeHero name={user?.firstName ?? 'دوست لوکو'} />
      <div className={styles.overlap}>
        <StatsBar coins={club.coins} streak={club.streak} xp={MOCK_STATS.xp} />
      </div>

      <TrafficRuleCard />
      <ChefRecipeCard />
      <LatestVideoCard />
      <GameZoneCard />
      <LatestPodcastCard />
      <ClubProgressCard
        doneToday={club.doneToday.length + club.sportDoneToday.length}
        streak={club.streak}
      />
      <CodingTeaser />
      <AboutCard />

      {mood.show && <MoodModal onSelect={mood.record} onClose={mood.dismiss} />}
    </StudentLayout>
  );
}
