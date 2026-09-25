import { useCallback, useMemo } from 'react';
import { SHOP_ITEMS } from '@/features/club/clubData';
import { recordPurchase } from '@/features/club/store';
import { useClub } from '@/features/club/useClub';
import type { ShopReward } from '@/features/club/types';
import { MAX_PLOT_LEVEL } from '@/features/garden/gardenData';
import { useGarden } from '@/features/garden/useGarden';
import { useTreasure } from '@/features/profile/useTreasure';
import { PRODUCTS } from './shopCatalog';
import type { Currency, ShopProduct } from './shopCatalog';

const fa = (n: number) => n.toLocaleString('fa-IR');

export const CURRENCY_LABEL: Record<Currency, string> = { coin: 'سکه', dew: 'شبنم', treasure: 'گنج' };

/** وضعیتِ یک کالا برای این بچه */
export type ProductState =
  | { kind: 'buy' }
  | { kind: 'poor'; missing: number }
  | { kind: 'owned' }
  | { kind: 'maxed' }
  | { kind: 'soon' };

export interface BuyOutcome {
  ok: boolean;
  message: string;
  /** کالا به باغچه رفت — پیام پیشنهادِ «بریم باغچه» می‌دهد */
  toGarden?: boolean;
}

/** «۳ دانه، ۲ کود و ۲۰ شبنم» — چیزی که واقعاً گرفت */
function rewardText(reward: ShopReward): string {
  const parts: string[] = [];
  if (reward.seeds) parts.push(`${fa(reward.seeds)} دانه`);
  if (reward.fertilizer) parts.push(`${fa(reward.fertilizer)} کود`);
  if (reward.dew) parts.push(`${fa(reward.dew)} شبنم`);
  return parts.join(' و ');
}

const BADGE_IDS = SHOP_ITEMS.filter((i) => i.kind === 'badge').map((i) => i.id);
const DECOR_KEYS = PRODUCTS.filter((p) => p.decorKey).map((p) => p.decorKey as string);

/**
 * فروشگاهِ یکپارچه روی سه کیف: سکه (کلاب)، شبنم (باغچه) و گنج (سرور).
 * خرید از همان راهِ قبلیِ هر کالا می‌گذرد؛ این‌جا فقط موجودی و وضعیت یک‌جا
 * خوانده و پیامِ درست برای بچه ساخته می‌شود.
 */
export function useShop() {
  const club = useClub();
  const garden = useGarden();
  const { treasures } = useTreasure();

  const balances: Record<Currency, number> = useMemo(
    () => ({ coin: club.coins, dew: garden.dew, treasure: treasures }),
    [club.coins, garden.dew, treasures],
  );

  const inventory = useMemo(
    () => ({
      seeds: garden.seeds,
      fertilizer: garden.fertilizer,
      plotLevel: garden.plotLevel,
      maxPlot: MAX_PLOT_LEVEL,
      decorOwned: DECOR_KEYS.filter((k) => garden.decor.includes(k)).length,
      decorTotal: DECOR_KEYS.length,
      badgesOwned: BADGE_IDS.filter((id) => club.owned.includes(id)).length,
      badgesTotal: BADGE_IDS.length,
    }),
    [garden.seeds, garden.fertilizer, garden.plotLevel, garden.decor, club.owned],
  );

  const stateOf = useCallback(
    (p: ShopProduct): ProductState => {
      if (p.source === 'soon') return { kind: 'soon' };
      if (p.stock === 'badge' && club.owned.includes(p.sourceId)) return { kind: 'owned' };
      if (p.stock === 'decor' && p.decorKey && garden.decor.includes(p.decorKey)) return { kind: 'owned' };
      if (p.stock === 'plot' && garden.plotLevel >= MAX_PLOT_LEVEL) return { kind: 'maxed' };
      const have = balances[p.currency];
      return have >= p.price ? { kind: 'buy' } : { kind: 'poor', missing: p.price - have };
    },
    [balances, club.owned, garden.decor, garden.plotLevel],
  );

  /** چیزی که بچه از این کالا الان دارد — کنارِ کالا نوشته می‌شود */
  const stockOf = useCallback(
    (p: ShopProduct): string | null => {
      switch (p.stock) {
        case 'seeds':
          return `${fa(garden.seeds)} دانه داری`;
        case 'fertilizer':
          return `${fa(garden.fertilizer)} کود داری`;
        case 'plot':
          return `سطحِ ${fa(garden.plotLevel)} از ${fa(MAX_PLOT_LEVEL)}`;
        default:
          return null;
      }
    },
    [garden.seeds, garden.fertilizer, garden.plotLevel],
  );

  const buy = useCallback(
    (p: ShopProduct): BuyOutcome => {
      if (p.source === 'soon') return { ok: false, message: 'این هنوز به فروشگاه نرسیده!' };

      if (p.source === 'club') {
        const result = club.buy(p.sourceId, p.price);
        if (!result.ok) {
          return {
            ok: false,
            message: result.reason === 'owned' ? 'این نشان رو قبلاً گرفتی.' : 'سکه‌ت برای این کافی نیست.',
          };
        }
        if (result.reward) return { ok: true, message: `گرفتی: ${rewardText(result.reward)}!`, toGarden: true };
        return { ok: true, message: 'نشانت روی پروفایلت نشست!' };
      }

      const result = garden.buy(p.sourceId);
      if (!result.ok) {
        const why: Record<string, string> = {
          nodew: 'شبنمت برای این کافی نیست.',
          maxed: 'باغچه‌ت به بزرگ‌ترین اندازه رسیده!',
          owned: 'این تزئین رو قبلاً گرفتی.',
        };
        return { ok: false, message: why[result.reason] ?? 'یه مشکلی پیش اومد.' };
      }
      recordPurchase(p.sourceId);
      const done: Record<string, string> = {
        plot: 'باغچه‌ت بزرگ‌تر شد و آب‌پاش پر شد!',
        decor: `${p.title} به باغچه‌ت اومد!`,
      };
      return {
        ok: true,
        message: done[p.stock] ?? `${p.title} رفت تو انبارِ باغچه‌ت!`,
        toGarden: true,
      };
    },
    [club, garden],
  );

  return { balances, inventory, stateOf, stockOf, buy };
}
