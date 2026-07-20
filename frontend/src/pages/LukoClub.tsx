import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { ClubHero } from '@/features/club/components/ClubHero/ClubHero';
import { WeekStreak } from '@/features/club/components/WeekStreak/WeekStreak';
import { DailyMissions } from '@/features/club/components/DailyMissions/DailyMissions';
import { SportsSection } from '@/features/club/components/SportsSection/SportsSection';
import { MedalsSection } from '@/features/club/components/MedalsSection/MedalsSection';
import { ShopSection } from '@/features/club/components/ShopSection/ShopSection';
import { useClub } from '@/features/club/useClub';
import styles from './LukoClub.module.css';

const GUIDE_STEPS = [
  'سلام قهرمان! من توپام، مربی باشگاه شهر لوکو!',
  'هر روز مأموریت‌های تازه داریم؛ انجامشون بدی ازم سکه می‌گیری!',
  'با سکه‌هات از فروشگاه جایزه بخر و مدال‌هات رو جمع کن. بزن بریم تمرین!',
];

export default function LukoClub() {
  const club = useClub();

  return (
    <StudentLayout className={styles.page}>
      <ClubHero coins={club.coins} />
      <WeekStreak days={club.days} streak={club.streak} />
      <DailyMissions doneIds={club.doneToday} onComplete={club.completeMission} />
      <SportsSection doneIds={club.sportDoneToday} onComplete={club.completeSportTask} />
      <MedalsSection medals={club.medals} />
      <ShopSection coins={club.coins} ownedIds={club.owned} onBuy={club.buy} />

      <CharacterGuide character={LUKORIANS.club} steps={GUIDE_STEPS} storageKey="club-intro" />
    </StudentLayout>
  );
}
