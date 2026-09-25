/**
 * کاتالوگِ فروشگاهِ یکپارچه‌ی لوکو.
 *
 * تا امروز دو فروشگاه جدا بود: «فروشگاهِ لوکو» در کلاب (با سکه) و «فروشگاهِ
 * باغبان» در باغچه (با شبنم). حالا همه‌چیزِ خریدنی یک‌جا، دسته‌بندی‌شده، در
 * کلاب است. قیمت و اثرِ هر کالا همان‌جایی که بوده تعریف می‌ماند
 * (`clubData.SHOP_ITEMS`، `gardenData.GARDEN_SHOP`) و این‌جا فقط چیده می‌شود —
 * پس خریدِ هر کالا از همان راهِ قبلی‌اش می‌گذرد و چیزی دوبار تعریف نمی‌شود.
 */
import type { ComponentType } from 'react';
import {
  HiOutlineFaceSmile,
  HiOutlineGift,
  HiOutlinePaintBrush,
  HiOutlinePencil,
  HiOutlineScissors,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineSwatch,
  HiOutlineTrophy,
  HiOutlineCamera,
} from 'react-icons/hi2';
import {
  ButterflyIcon,
  FertilizerIcon,
  LanternIcon,
  PlotIcon,
  PondIcon,
  SeedIcon,
} from '@/components/ui/icons';
import { SHOP_ITEMS } from '@/features/club/clubData';
import { GARDEN_SHOP } from '@/features/garden/gardenData';
import { BUILDER_PRICES, CUSTOM_CHARACTER } from '@/features/profile/config';

export type Currency = 'coin' | 'dew' | 'treasure';

export type ShopCategory = 'garden' | 'decor' | 'badges' | 'workshop';

export const CATEGORIES: { id: ShopCategory; label: string; hint: string }[] = [
  { id: 'garden', label: 'باغچه', hint: 'دانه، کود و جای بیشتر برای گیاه‌ها' },
  { id: 'decor', label: 'تزئینِ باغچه', hint: 'یک بار می‌خری، برای همیشه تو باغچه‌ته' },
  { id: 'badges', label: 'نشان‌ها', hint: 'روی پروفایلت می‌نشینن و همه می‌بینن' },
  { id: 'workshop', label: 'کارگاهِ لوکوریان', hint: 'با گنج — به‌زودی باز می‌شه' },
];

/**
 * از کجا خریده می‌شود: `club` با سکه از کیفِ اصلی، `garden` با شبنم از باغچه،
 * `soon` هنوز خریدنی نیست (کارگاهِ لوکوریان).
 */
export type ShopSource = 'club' | 'garden' | 'soon';

/** چه چیزی از موجودیِ بچه کنارِ کالا نشان داده می‌شود */
export type Stock = 'seeds' | 'fertilizer' | 'plot' | 'decor' | 'badge' | 'none';

/** آیکونِ hi2 یا آیکونِ اختصاصیِ لوکو — روی کالا بی‌هیچ پراپی رسم می‌شود */
type ShopIcon = ComponentType;

export interface ShopProduct {
  /** یکتا در کلِ فروشگاه */
  id: string;
  source: ShopSource;
  /** شناسه در کاتالوگِ منبع (برای خرید) */
  sourceId: string;
  category: ShopCategory;
  title: string;
  desc: string;
  price: number;
  currency: Currency;
  icon: ShopIcon;
  stock: Stock;
  /** برای تزئین: همان کلیدی که در باغچه ذخیره می‌شود */
  decorKey?: string;
  /** کالای کمیاب (قابِ طلایی) */
  rare?: boolean;
}

const club = (id: string) => {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`کالای کلاب نیست: ${id}`);
  return item;
};
const garden = (id: string) => {
  const item = GARDEN_SHOP.find((i) => i.id === id);
  if (!item) throw new Error(`کالای باغچه نیست: ${id}`);
  return item;
};

const fromClub = (id: string, category: ShopCategory, icon: ShopIcon, stock: Stock, rare = false): ShopProduct => {
  const item = club(id);
  return {
    id: `club:${id}`, source: 'club', sourceId: id, category, title: item.title, desc: item.desc,
    price: item.cost, currency: 'coin', icon, stock, rare,
  };
};

const fromGarden = (id: string, category: ShopCategory, icon: ShopIcon, stock: Stock): ShopProduct => {
  const item = garden(id);
  return {
    id: `garden:${id}`, source: 'garden', sourceId: id, category, title: item.title, desc: item.desc,
    price: item.cost, currency: 'dew', icon, stock, decorKey: item.kind === 'decor' ? (item.payload ?? item.id) : undefined,
  };
};

const soon = (id: string, title: string, icon: ShopIcon, price: number): ShopProduct => ({
  id: `workshop:${id}`, source: 'soon', sourceId: id, category: 'workshop', title,
  desc: 'برای لوکوریانِ خودت', price, currency: 'treasure', icon, stock: 'none',
});

export const PRODUCTS: ShopProduct[] = [
  // ── باغچه: هر کدام را هم با شبنم می‌شود خرید هم با سکه ──
  fromGarden('seed-pack', 'garden', SeedIcon, 'seeds'),
  fromClub('seeds', 'garden', SeedIcon, 'seeds'),
  fromGarden('fertilizer', 'garden', FertilizerIcon, 'fertilizer'),
  fromClub('fertilizer', 'garden', FertilizerIcon, 'fertilizer'),
  fromGarden('plot', 'garden', PlotIcon, 'plot'),
  fromClub('mystery', 'garden', HiOutlineGift, 'none'),

  // ── تزئینِ باغچه ──
  fromGarden('decor-butterfly', 'decor', ButterflyIcon, 'decor'),
  fromGarden('decor-lantern', 'decor', LanternIcon, 'decor'),
  fromGarden('decor-pond', 'decor', PondIcon, 'decor'),

  // ── نشان‌ها ──
  fromClub('badge-hero', 'badges', HiOutlineShieldCheck, 'badge', true),
  fromClub('badge-cup', 'badges', HiOutlineTrophy, 'badge', true),

  // ── کارگاهِ لوکوریان (با گنج؛ هنوز خریدنی نیست) ──
  soon('skin', 'رنگِ پوست', HiOutlinePaintBrush, BUILDER_PRICES.skinColor),
  soon('outfit', 'لباس', HiOutlineSwatch, BUILDER_PRICES.outfit),
  soon('hair', 'مدلِ مو', HiOutlineScissors, BUILDER_PRICES.hair),
  soon('face', 'چهره', HiOutlineFaceSmile, BUILDER_PRICES.face),
  soon('name', 'اسم', HiOutlinePencil, BUILDER_PRICES.name),
  soon('accessory', 'اکسسوری', HiOutlineSparkles, BUILDER_PRICES.accessory),
  {
    ...soon('custom', 'لوکوریانِ شبیهِ خودت', HiOutlineCamera, CUSTOM_CHARACTER.priceTreasure),
    desc: 'از روی عکست، مخصوصِ خودت',
    rare: true,
  },
];

export const productsIn = (category: ShopCategory) => PRODUCTS.filter((p) => p.category === category);
