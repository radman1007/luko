import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiOutlineCheckBadge,
  HiOutlineChevronLeft,
  HiOutlineClock,
  HiOutlineLockClosed,
  HiOutlineShoppingBag,
} from 'react-icons/hi2';
import { CoinIcon, DewIcon, FertilizerIcon, PlotIcon, SeedIcon, TreasureIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { CATEGORIES, productsIn } from '../../shopCatalog';
import type { Currency, ShopCategory, ShopProduct } from '../../shopCatalog';
import { CURRENCY_LABEL, useShop } from '../../useShop';
import styles from './LukoShop.module.css';

const fa = (n: number) => n.toLocaleString('fa-IR');

const CURRENCY_ICON: Record<Currency, typeof CoinIcon> = {
  coin: CoinIcon,
  dew: DewIcon,
  treasure: TreasureIcon,
};

/** پرسشِ «مطمئنی؟» بعد از این مدت خودش می‌رود */
const CONFIRM_MS = 4000;
const TOAST_MS = 3600;

const isCategory = (v: string | null): v is ShopCategory => CATEGORIES.some((c) => c.id === v);

/**
 * فروشگاهِ یکپارچه‌ی شهرِ لوکو — تنها جایی که چیزی خریده می‌شود.
 *
 * بالای فروشگاه هر سه کیف (سکه، شبنم، گنج) و «کوله‌پشتی» (آنچه بچه از هر
 * چیز دارد) جلوی چشم است؛ کنارِ هر کالا هم موجودیِ همان چیز. خرید دو ضربه
 * است — ضربه‌ی اول می‌پرسد «بخرمش؟» — چون بچه زیاد اشتباهی می‌زند و سکه‌ای که
 * رفت برنمی‌گردد. `?shop=garden` دسته‌ی باغچه را باز می‌کند (میان‌بُرِ صفحه‌ی باغچه).
 */
export function LukoShop() {
  const shop = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const asked = params.get('shop');
  const [category, setCategory] = useState<ShopCategory>(isCategory(asked) ? asked : 'garden');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string; toGarden?: boolean } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const toastTimer = useRef(0);

  // از میان‌بُرِ باغچه آمده: همان‌جا بایست
  useEffect(() => {
    if (!isCategory(asked)) return;
    setCategory(asked);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [asked]);

  useEffect(() => {
    if (!confirming) return undefined;
    const id = window.setTimeout(() => setConfirming(null), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirming]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (next: NonNullable<typeof toast>) => {
    setToast(next);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  };

  const press = (p: ShopProduct) => {
    if (confirming !== p.id) {
      setConfirming(p.id);
      return;
    }
    setConfirming(null);
    const result = shop.buy(p);
    showToast({ ok: result.ok, text: result.message, toGarden: result.toGarden });
  };

  const products = productsIn(category);
  const active = CATEGORIES.find((c) => c.id === category)!;
  const { inventory } = shop;

  return (
    <section ref={sectionRef} id="shop" className={styles.shop} aria-label="فروشگاه لوکو">
      <div className={styles.awning} aria-hidden />

      <header className={styles.head}>
        <img className={styles.keeper} src={LUKORIANS.club.image} alt="" aria-hidden />
        <div className={styles.titles}>
          <h2 className={styles.title}>
            <HiOutlineShoppingBag aria-hidden />
            فروشگاهِ شهرِ لوکو
          </h2>
          <p className={styles.sub}>هر چی لازم داری، همه یک‌جا — با سکه، شبنم یا گنج</p>
        </div>
      </header>

      {/* ── کیف‌ها ─────────────────────────────────────────── */}
      <ul className={styles.wallet} aria-label="موجودیِ کیف‌ها">
        {(Object.keys(CURRENCY_ICON) as Currency[]).map((c) => {
          const Icon = CURRENCY_ICON[c];
          return (
            <li key={c} className={`${styles.purse} ${styles[c]}`}>
              <Icon size={20} aria-hidden />
              <b>{fa(shop.balances[c])}</b>
              <small>{CURRENCY_LABEL[c]}</small>
            </li>
          );
        })}
      </ul>

      {/* ── کوله‌پشتی: آنچه از هر چیز داری ────────────────── */}
      <div className={styles.bag}>
        <span className={styles.bagTitle}>کوله‌پشتیِ من</span>
        <ul className={styles.bagList}>
          <li>
            <SeedIcon size={16} aria-hidden />
            {fa(inventory.seeds)} دانه
          </li>
          <li>
            <FertilizerIcon size={16} aria-hidden />
            {fa(inventory.fertilizer)} کود
          </li>
          <li>
            <PlotIcon size={16} aria-hidden />
            باغچه سطحِ {fa(inventory.plotLevel)} از {fa(inventory.maxPlot)}
          </li>
          <li>
            <HiOutlineCheckBadge aria-hidden />
            {fa(inventory.decorOwned)} از {fa(inventory.decorTotal)} تزئین
          </li>
          <li>
            <HiOutlineCheckBadge aria-hidden />
            {fa(inventory.badgesOwned)} از {fa(inventory.badgesTotal)} نشان
          </li>
        </ul>
      </div>

      {/* ── دسته‌ها ────────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist" aria-label="دسته‌های فروشگاه">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === category}
            className={`${styles.tab} ${c.id === category ? styles.tabOn : ''}`}
            onClick={() => {
              setCategory(c.id);
              setConfirming(null);
            }}
          >
            {c.label}
            <span className={styles.tabCount}>{fa(productsIn(c.id).length)}</span>
          </button>
        ))}
      </div>
      <p className={styles.hint}>{active.hint}</p>

      {/* ── قفسه ───────────────────────────────────────────── */}
      <ul className={styles.grid} role="tabpanel" aria-label={active.label}>
        {products.map((p) => {
          const state = shop.stateOf(p);
          const stock = shop.stockOf(p);
          const Price = CURRENCY_ICON[p.currency];
          const asking = confirming === p.id;

          return (
            <li
              key={p.id}
              className={[
                styles.tile,
                styles[`cat_${p.category}`],
                p.rare ? styles.rare : '',
                state.kind === 'owned' ? styles.owned : '',
                state.kind === 'soon' ? styles.soon : '',
              ].join(' ')}
            >
              <span className={styles.plate} aria-hidden>
                <p.icon />
              </span>

              {state.kind === 'owned' ? (
                <span className={`${styles.stock} ${styles.stockOwned}`}>
                  <HiOutlineCheckBadge aria-hidden />
                  مالِ خودته
                </span>
              ) : state.kind === 'soon' ? (
                <span className={`${styles.stock} ${styles.stockSoon}`}>
                  <HiOutlineClock aria-hidden />
                  به‌زودی
                </span>
              ) : (
                stock && <span className={styles.stock}>{stock}</span>
              )}

              <span className={styles.name}>{p.title}</span>
              <span className={styles.desc}>{p.desc}</span>

              {state.kind === 'owned' ? null : state.kind === 'maxed' ? (
                <span className={styles.done}>به آخرین سطح رسیده</span>
              ) : (
                <button
                  type="button"
                  className={[
                    styles.price,
                    styles[`pay_${p.currency}`],
                    asking ? styles.asking : '',
                  ].join(' ')}
                  disabled={state.kind !== 'buy'}
                  onClick={() => press(p)}
                  aria-label={
                    asking
                      ? `مطمئنی؟ خریدِ ${p.title} با ${fa(p.price)} ${CURRENCY_LABEL[p.currency]}`
                      : `${p.title}، ${fa(p.price)} ${CURRENCY_LABEL[p.currency]}`
                  }
                >
                  {asking ? (
                    'بخرمش؟'
                  ) : (
                    <>
                      {state.kind === 'poor' ? <HiOutlineLockClosed aria-hidden /> : <Price size={15} aria-hidden />}
                      {/* نامِ کیف هم نوشته می‌شود: قطره‌ی شبنم کنارِ عدد شبیهِ «۵» خوانده می‌شد */}
                      {fa(p.price)}
                      <span className={styles.priceUnit}>{CURRENCY_LABEL[p.currency]}</span>
                    </>
                  )}
                </button>
              )}

              {state.kind === 'poor' && (
                <span className={styles.missing}>
                  {fa(state.missing)} {CURRENCY_LABEL[p.currency]} کم داری
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {toast && (
        <div className={`${styles.toast} ${toast.ok ? '' : styles.toastBad}`} role="status">
          <span>{toast.text}</span>
          {toast.ok && toast.toGarden && (
            <button type="button" className={styles.toastGo} onClick={() => navigate('/garden')}>
              بریم باغچه
              <HiOutlineChevronLeft aria-hidden />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
