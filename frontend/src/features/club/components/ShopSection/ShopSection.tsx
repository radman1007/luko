import { useEffect, useRef, useState } from 'react';
import { HiOutlineCheckBadge, HiOutlineLockClosed, HiOutlineSparkles } from 'react-icons/hi2';
import { CoinIcon, DewIcon } from '@/components/ui/icons';
import { SHOP_ITEMS } from '../../clubData';
import type { BuyResult } from '../../store';
import type { ShopReward } from '../../types';
import styles from './ShopSection.module.css';

interface Props {
  coins: number;
  ownedIds: string[];
  onBuy: (itemId: string, cost: number) => BuyResult;
}

/** «۳ دانه، ۲ کود و ۲۰ شبنم» — چیزی که واقعاً گرفت */
function rewardText(reward: ShopReward): string {
  const parts: string[] = [];
  if (reward.seeds) parts.push(`${reward.seeds.toLocaleString('fa-IR')} دانه`);
  if (reward.fertilizer) parts.push(`${reward.fertilizer.toLocaleString('fa-IR')} کود`);
  if (reward.dew) parts.push(`${reward.dew.toLocaleString('fa-IR')} شبنم`);
  return parts.join(' و ');
}

/**
 * فروشگاهِ لوکو.
 * هر کالا اثرِ واقعی دارد: بسته‌ها همان لحظه به باغچه می‌ریزند و نشان‌ها
 * روی پروفایل می‌نشینند — پس بعد از خرید پیامِ «چی گرفتی» نشان داده می‌شود.
 */
export function ShopSection({ coins, ownedIds, onBuy }: Props) {
  const [flash, setFlash] = useState<{ id: string; text: string } | null>(null);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleBuy = (itemId: string, cost: number, isBadge: boolean) => {
    const result = onBuy(itemId, cost);
    if (!result.ok) return;
    const text = result.reward
      ? `گرفتی: ${rewardText(result.reward)}`
      : isBadge
        ? 'نشانت روی پروفایل نشست!'
        : 'خریدی!';
    setFlash({ id: itemId, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), 3200);
  };

  return (
    <section className={styles.card} aria-label="فروشگاه لوکو">
      <header className={styles.head}>
        <div className={styles.titles}>
          <h2 className={styles.title}>
            <HiOutlineSparkles aria-hidden />
            فروشگاهِ لوکو
          </h2>
          <p className={styles.subtitle}>سکه‌هات رو خرج چیزهای به‌دردبخور کن</p>
        </div>
        <span className={styles.wallet}>
          <CoinIcon size={16} aria-hidden />
          {coins.toLocaleString('fa-IR')}
        </span>
      </header>

      <ul className={styles.grid}>
        {SHOP_ITEMS.map((item) => {
          const isBadge = item.kind === 'badge';
          const owned = isBadge && ownedIds.includes(item.id);
          const affordable = coins >= item.cost;
          const showing = flash?.id === item.id;

          return (
            <li
              key={item.id}
              className={`${styles.item} ${isBadge ? styles.rare : ''} ${owned ? styles.ownedItem : ''}`}
            >
              <span className={styles.iconWrap} aria-hidden>
                <item.icon />
              </span>

              <span className={styles.texts}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.desc}>{showing ? flash.text : item.desc}</span>
              </span>

              {owned ? (
                <span className={styles.owned}>
                  <HiOutlineCheckBadge aria-hidden />
                  مالِ خودته
                </span>
              ) : (
                <button
                  type="button"
                  className={affordable ? styles.buyBtn : styles.buyBtnPoor}
                  onClick={() => handleBuy(item.id, item.cost, isBadge)}
                  disabled={!affordable}
                  aria-label={`خریدِ ${item.title} با ${item.cost.toLocaleString('fa-IR')} سکه`}
                >
                  {affordable ? <CoinIcon size={15} aria-hidden /> : <HiOutlineLockClosed aria-hidden />}
                  {item.cost.toLocaleString('fa-IR')}
                </button>
              )}

              {showing && (
                <span className={styles.flash} aria-live="polite">
                  <DewIcon size={13} aria-hidden />
                  {flash.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
