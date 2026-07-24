import { useEffect, useState } from 'react';
import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { GardenHero } from '@/features/garden/components/GardenHero/GardenHero';
import { GardenScene } from '@/features/garden/components/GardenScene/GardenScene';
import { GardenToolbar } from '@/features/garden/components/GardenToolbar/GardenToolbar';
import { GardenShop } from '@/features/garden/components/GardenShop/GardenShop';
import { DewSources } from '@/features/garden/components/DewSources/DewSources';
import { useGarden } from '@/features/garden/useGarden';
import type { ActionResult } from '@/features/garden/store';
import styles from './Garden.module.css';

const GUIDE_STEPS = [
  'سلام! من سبزو هستم، باغبونِ شهر لوکو. این باغچه‌ی خودته!',
  'به گیاه‌هات آب بده، کود بده و دونه بکار تا توی یه سال تحصیلی قد بکشن و گل بدن.',
  'با «شبنم» باغچه رو بزرگ‌تر و قشنگ‌تر کن؛ شبنم رو از بازی‌ها، مأموریت‌ها، مدال‌ها و وقتی که اینجا می‌مونی می‌گیری!',
];

const REASON_MSG: Record<string, string> = {
  full: 'همه‌ی جای کاشت‌ها پره! با شبنم باغچه رو بزرگ‌تر کن.',
  noseed: 'دانه نداری؛ از فروشگاه دانه بخر.',
  nowater: 'آب‌پاش خالیه؛ کمی صبر کن تا پر بشه.',
  nofert: 'کود نداری؛ از بازی‌ها کود بگیر یا از فروشگاه بخر.',
  noplant: 'اول یه دانه بکار!',
  nodew: 'شبنم کافی نداری.',
  maxed: 'باغچه به بزرگ‌ترین اندازه رسیده!',
  owned: 'این تزئین رو قبلاً گرفتی.',
  unknown: 'یه مشکلی پیش اومد.',
};

export default function Garden() {
  const g = useGarden();
  const [watering, setWatering] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    if (!watering) return;
    const id = setTimeout(() => setWatering(false), 1400);
    return () => clearTimeout(id);
  }, [watering]);

  const after = (r: ActionResult, success: string) =>
    setFlash(r.ok ? success : REASON_MSG[r.reason] ?? REASON_MSG.unknown);

  const handleWater = () => {
    const r = g.waterAll();
    if (r.ok) setWatering(true);
    after(r, 'آب دادی! آفرین.');
  };
  const handleFertilize = () => after(g.fertilizeAll(), 'کود دادی! گیاه‌ها جون گرفتن.');
  const handlePlant = () => after(g.plantSeed(), 'یه دانه کاشتی! آبش بده تا رشد کنه.');
  const handleBuy = (id: string) => after(g.buy(id), 'خرید انجام شد!');

  return (
    <StudentLayout className={styles.page}>
      <GardenHero dew={g.dew} season={g.season} />

      <div className={styles.sceneWrap}>
        <GardenScene
          plants={g.plants}
          slots={g.slots}
          decor={g.decor}
          season={g.season.season}
          watering={watering}
          canPlant={g.canPlant}
          onPlantSlot={handlePlant}
        />
      </div>

      <GardenToolbar
        currentWater={g.currentWater}
        maxWater={g.maxWater}
        nextRefillMs={g.nextRefillMs}
        fertilizer={g.fertilizer}
        seeds={g.seeds}
        canWater={g.canWater}
        canFertilize={g.canFertilize}
        canPlant={g.canPlant}
        onWater={handleWater}
        onFertilize={handleFertilize}
        onPlant={handlePlant}
      />

      <DewSources dewLog={g.dewLog} />
      <GardenShop dew={g.dew} plotLevel={g.plotLevel} decor={g.decor} onBuy={handleBuy} />

      {flash && (
        <div className={styles.flash} role="status">
          {flash}
        </div>
      )}

      <CharacterGuide character={LUKORIANS.garden} steps={GUIDE_STEPS} storageKey="garden-intro" />
    </StudentLayout>
  );
}
