import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { HealthHero } from '@/features/health/components/HealthHero/HealthHero';
import { MoodCheckinCard } from '@/features/health/components/MoodCheckinCard/MoodCheckinCard';
import { PaintingCard } from '@/features/health/components/PaintingCard/PaintingCard';
import { BreathingCard } from '@/features/health/components/BreathingCard/BreathingCard';
import { SecretsCard } from '@/features/health/components/SecretsCard/SecretsCard';
import { MoodModal } from '@/features/health/components/MoodModal/MoodModal';
import { useMoodReminder } from '@/features/health/useMoodReminder';
import styles from './LukoHealth.module.css';

const GUIDE_STEPS = [
  'سلام! من دکتر نیلا هستم، پزشک شهر لوکو. به خونه‌ی سلامتی خوش اومدی!',
  'اینجا می‌تونی حال دلت رو بگی، با «نفس جادویی» آروم بشی و روی بوم نقاشی کنی.',
  'یه صندوقچه‌ی راز هم داری که فقط با رمز خودت باز می‌شه؛ رازهات پیش من امنه!',
];

export default function LukoHealth() {
  const mood = useMoodReminder();

  return (
    <StudentLayout className={styles.page}>
      <HealthHero />
      <MoodCheckinCard lastMood={mood.lastMood} onOpen={mood.open} />
      <BreathingCard />
      <PaintingCard />
      <SecretsCard />

      {mood.show && <MoodModal onSelect={mood.record} onClose={mood.dismiss} />}
      <CharacterGuide character={LUKORIANS.health} steps={GUIDE_STEPS} storageKey="health-intro" />
    </StudentLayout>
  );
}
