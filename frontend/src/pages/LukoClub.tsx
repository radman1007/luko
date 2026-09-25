import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { Board, Column } from '@/components/layout/Board/Board';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { ClubHero } from '@/features/club/components/ClubHero/ClubHero';
import { WeekStreak } from '@/features/club/components/WeekStreak/WeekStreak';
import { DailyMissions } from '@/features/club/components/DailyMissions/DailyMissions';
import { SportsSection } from '@/features/club/components/SportsSection/SportsSection';
import { LukoShop } from '@/features/shop/components/LukoShop/LukoShop';
import { useClub } from '@/features/club/useClub';
import styles from './LukoClub.module.css';

const GUIDE_STEPS = [
  'سلام قهرمان! من توپام، مربی باشگاه شهر لوکو!',
  'هر روز مأموریت‌های تازه داریم؛ انجامشون بدی ازم سکه می‌گیری!',
  'پایینِ همین صفحه فروشگاهِ شهره: هر چی برای باغچه و پروفایلت بخوای، همون‌جاست. بزن بریم تمرین!',
];

export default function LukoClub() {
  const club = useClub();

  return (
    <StudentLayout className={styles.page}>
      <ClubHero coins={club.coins} />
      <WeekStreak days={club.days} streak={club.streak} />
      <Board>
        <Column side="start">
          <DailyMissions doneIds={club.doneToday} />
        </Column>
        <Column side="end">
          <SportsSection doneIds={club.sportDoneToday} />
        </Column>
      </Board>
      {/* تنها فروشگاهِ اپ — باغچه، نشان‌ها و کارگاه همه این‌جا؛ مدال‌ها در تالارِ افتخاراتِ پروفایل‌اند */}
      <LukoShop />

      <CharacterGuide character={LUKORIANS.club} steps={GUIDE_STEPS} storageKey="club-intro" />
    </StudentLayout>
  );
}
