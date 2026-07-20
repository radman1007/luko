import { HiOutlineCheckBadge } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { SHOP_ITEMS } from '../../clubData';
import styles from './ShopSection.module.css';

interface Props {
  coins: number;
  ownedIds: string[];
  onBuy: (itemId: string, cost: number) => void;
}

export function ShopSection({ coins, ownedIds, onBuy }: Props) {
  return (
    <section className={styles.card} aria-label="فروشگاه باشگاه">
      <h2 className={styles.title}>فروشگاه توپا</h2>
      <p className={styles.subtitle}>سکه‌هات رو خرج جایزه‌های باحال کن</p>

      <div className={styles.grid}>
        {SHOP_ITEMS.map((item) => {
          const owned = ownedIds.includes(item.id);
          const affordable = coins >= item.cost;
          return (
            <div key={item.id} className={styles.item}>
              <span className={styles.iconWrap} aria-hidden>
                <item.icon />
              </span>
              <span className={styles.itemTitle}>{item.title}</span>
              {owned ? (
                <span className={styles.owned}>
                  <HiOutlineCheckBadge aria-hidden />
                  مال خودته!
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.buyBtn}
                  onClick={() => onBuy(item.id, item.cost)}
                  disabled={!affordable}
                >
                  <CoinIcon size={15} aria-hidden />
                  {item.cost.toLocaleString('fa-IR')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
