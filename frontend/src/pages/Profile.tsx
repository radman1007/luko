import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { Board, Column } from '@/components/layout/Board/Board';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { useAuth } from '@/features/auth/context';
import { useClub } from '@/features/club/useClub';
import { useMedals } from '@/features/club/useMedals';
import { useCompletedStages } from '@/features/games/useSeasonProgress';
import { usePoints } from '@/features/profile/usePoints';
import { ProfileHero } from '@/features/profile/components/ProfileHero/ProfileHero';
import { StatsGrid } from '@/features/profile/components/StatsGrid/StatsGrid';
import { BuilderCard } from '@/features/profile/components/Builder/BuilderCard';
import { GalleryCard } from '@/features/profile/components/GalleryCard/GalleryCard';
import { TrophyHall } from '@/features/profile/components/TrophyHall/TrophyHall';
import { SettingsCard } from '@/features/profile/components/SettingsCard/SettingsCard';
import { useTreasure } from '@/features/profile/useTreasure';
import styles from './Profile.module.css';

const GUIDE_STEPS = [
  'سلام! من مکانوام، سازنده و مکانیک شهر لوکو. اینجا اتاق خودته!',
  'همه‌ی سکه‌ها، امتیازها و مدال‌هات رو همین‌جا می‌بینی.',
  'تالارِ افتخاراتت هم همین‌جاست؛ هر مدال رو بزنی می‌گه چطور می‌گیریش.',
  'گنجینه‌ی نقاشی‌هات هم همین‌جاست؛ هرکدوم رو بزنی بزرگ می‌بینیش.',
  'پایین صفحه کارگاهمه؛ رفیقم «کاشف» اونجا از گنج‌های گمشده برات می‌گه!',
];

export default function Profile() {
  const { user } = useAuth();
  const club = useClub();
  const { treasures } = useTreasure();
  const medals = useMedals();
  // همان پیشرفتِ سرور که نقشه نشان می‌دهد، و فقط مرحله‌های مسیرِ خودِ بچه
  const gamesCompleted = useCompletedStages();

  const medalsUnlocked = medals.filter((m) => m.unlocked).length;
  const xp = usePoints();

  return (
    <StudentLayout className={styles.page}>
      <ProfileHero user={user} ownedIds={club.owned} />
      <StatsGrid
        coins={club.coins}
        xp={xp}
        streak={club.streak}
        gamesCompleted={gamesCompleted}
        medalsUnlocked={medalsUnlocked}
        treasures={treasures}
      />
      {/* تبلت: تالار کنارِ کارگاه و گنجینه، دو ردیف می‌گیرد */}
      <Board>
        <Column side="start">
          <BuilderCard
            stats={{
              coins: club.coins,
              totalTasks: club.total,
              streak: club.streak,
              gamesCompleted,
            }}
            treasures={treasures}
          />
        </Column>
        <Column side="end" className={styles.tallCol}>
          <TrophyHall medals={medals} />
        </Column>
        <Column side="start">
          <GalleryCard />
        </Column>
      </Board>
      <SettingsCard />

      <CharacterGuide character={LUKORIANS.maker} steps={GUIDE_STEPS} storageKey="profile-intro" />
    </StudentLayout>
  );
}
