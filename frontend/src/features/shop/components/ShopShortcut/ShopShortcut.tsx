import { useNavigate } from 'react-router-dom';
import { HiOutlineChevronLeft, HiOutlineShoppingBag } from 'react-icons/hi2';
import { CoinIcon, DewIcon } from '@/components/ui/icons';
import type { ShopCategory } from '../../shopCatalog';
import styles from './ShopShortcut.module.css';

interface Props {
  /** کدام دسته‌ی فروشگاه باز شود */
  category: ShopCategory;
  title: string;
  text: string;
  coins: number;
  dew: number;
}

/**
 * میان‌بُر به فروشگاهِ یکپارچه‌ی باشگاه. خودِ این صفحه دیگر فروشگاه ندارد؛
 * این کارت فقط می‌گوید چقدر پول داری و یک ضربه تا همان دسته فاصله است.
 */
export function ShopShortcut({ category, title, text, coins, dew }: Props) {
  const navigate = useNavigate();
  const fa = (n: number) => n.toLocaleString('fa-IR');

  return (
    <section className={styles.card} aria-label={title}>
      <span className={styles.icon} aria-hidden>
        <HiOutlineShoppingBag />
      </span>
      <div className={styles.texts}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{text}</p>
        <p className={styles.purse}>
          <span>
            <DewIcon size={15} aria-hidden />
            {fa(dew)} شبنم
          </span>
          <span>
            <CoinIcon size={15} aria-hidden />
            {fa(coins)} سکه
          </span>
        </p>
      </div>
      <button type="button" className={styles.go} onClick={() => navigate(`/luko-club?shop=${category}`)}>
        بریم فروشگاه
        <HiOutlineChevronLeft aria-hidden />
      </button>
    </section>
  );
}
