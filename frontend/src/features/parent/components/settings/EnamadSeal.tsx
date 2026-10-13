import styles from './EnamadSeal.module.css';

interface Props {
  /** «کارت»: با توضیح کنارش؛ «ساده»: فقط نشان */
  variant?: 'card' | 'plain';
}

const LINK = 'https://trustseal.enamad.ir/?id=8028112&Code=6qCdfbdgMb9dFb6ERmhx6w13ggY2hHhV';
const IMAGE = 'https://trustseal.enamad.ir/logo.aspx?id=8028112&Code=6qCdfbdgMb9dFb6ERmhx6w13ggY2hHhV';

/**
 * نمادِ اعتمادِ الکترونیکی. اینماد نشانی و referrerِ صفحه را می‌سنجد؛ برای همین
 * `referrerPolicy="origin"` روی همان پیوند و تصویر است (سربرگِ سایت same-origin است).
 */
export function EnamadSeal({ variant = 'card' }: Props) {
  const seal = (
    <a className={styles.seal} referrerPolicy="origin" target="_blank" rel="noopener" href={LINK}
      aria-label="نمادِ اعتمادِ الکترونیکیِ لوکو">
      <img referrerPolicy="origin" src={IMAGE} alt="" style={{ cursor: 'pointer' }}
        {...{ code: '6qCdfbdgMb9dFb6ERmhx6w13ggY2hHhV' }} />
    </a>
  );
  if (variant === 'plain') return seal;
  return (
    <div className={styles.card}>
      {seal}
      <div className={styles.text}>
        <b>نمادِ اعتمادِ الکترونیکی</b>
        <p>لوکو دارای نمادِ اعتماد از مرکزِ توسعه‌ی تجارتِ الکترونیکی است. پرداخت‌ها از درگاهِ امنِ شاپرک انجام می‌شود.</p>
      </div>
    </div>
  );
}
