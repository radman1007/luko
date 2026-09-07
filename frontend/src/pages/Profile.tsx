import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { useAuth } from '@/features/auth/context';
import { useClub } from '@/features/club/useClub';
import { useMedals } from '@/features/club/useMedals';
import { MOCK_STATS } from '@/features/home/mockData';
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

function readGamesCompleted(): number {
  try {
    const raw = localStorage.getItem('luko_completed_games');
    if (raw) return (JSON.parse(raw) as string[]).length;
  } catch {
    /* داده‌ی خراب → صفر */
  }
  return 0;
}

export default function Profile() {
  const { user } = useAuth();
  const club = useClub();
  const { treasures } = useTreasure();
  const medals = useMedals();
  const gamesCompleted = readGamesCompleted();

  const medalsUnlocked = medals.filter((m) => m.unlocked).length;
  // TODO: xp بعد از آماده شدن بک‌اند واقعی می‌شود
  const xp = MOCK_STATS.xp;

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
      <BuilderCard
        stats={{
          coins: club.coins,
          totalTasks: club.total,
          streak: club.streak,
          gamesCompleted,
        }}
        treasures={treasures}
      />
      <TrophyHall medals={medals} />
      <GalleryCard />
      <SettingsCard />

      <CharacterGuide character={LUKORIANS.maker} steps={GUIDE_STEPS} storageKey="profile-intro" />
    </StudentLayout>
  );
}
