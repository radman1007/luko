import { HiOutlineCheck } from 'react-icons/hi2';
import { DewIcon } from '@/components/ui/icons';
import { GARDEN_SHOP, MAX_PLOT_LEVEL } from '../../gardenData';
import styles from './GardenShop.module.css';

interface Props {
  dew: number;
  plotLevel: number;
  decor: string[];
  onBuy: (id: string) => void;
}

/** فروشگاه باغچه: با شبنم دانه، کود، ارتقای باغچه و تزئین می‌خری */
export function GardenShop({ dew, plotLevel, decor, onBuy }: Props) {
  return (
    <section className={styles.wrap} aria-label="فروشگاه باغچه">
      <h2 className={styles.title}>فروشگاه باغبان</h2>
      <p className={styles.sub}>شبنم‌هایت را خرج کن و باغچه را بهتر کن</p>

      <ul className={styles.grid}>
        {GARDEN_SHOP.map((item) => {
          const owned = item.kind === 'decor' && decor.includes(item.payload ?? item.id);
          const maxed = item.kind === 'plot' && plotLevel >= MAX_PLOT_LEVEL;
          const disabled = owned || maxed || dew < item.cost;
          const title = item.kind === 'plot' ? `${item.title} (سطح ${plotLevel.toLocaleString('fa-IR')})` : item.title;

          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.info}>
                <span className={styles.name}>{title}</span>
                <span className={styles.desc}>{owned ? 'خریداری‌شده' : maxed ? 'به بیشترین سطح رسیده' : item.desc}</span>
              </div>
              <button type="button" className={styles.buy} onClick={() => onBuy(item.id)} disabled={disabled}>
                {owned || maxed ? (
                  <HiOutlineCheck className={styles.done} aria-hidden />
                ) : (
                  <>
                    <DewIcon size={15} aria-hidden />
                    {item.cost.toLocaleString('fa-IR')}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
