/**
 * فروشگاهِ یکپارچه همان کالاهای دو فروشگاهِ قبلی را دارد — نه کمتر، نه با
 * قیمتِ دیگر. کالای جاافتاده یعنی چیزی که بچه دیگر هیچ‌جا نمی‌تواند بخرد.
 */
import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS } from '@/features/club/clubData';
import { GARDEN_SHOP } from '@/features/garden/gardenData';
import { CATEGORIES, PRODUCTS, productsIn } from '../shopCatalog';

describe('کاتالوگِ فروشگاهِ یکپارچه', () => {
  it('همه‌ی کالاهای کلاب با همان قیمت و با سکه', () => {
    for (const item of SHOP_ITEMS) {
      const p = PRODUCTS.find((x) => x.source === 'club' && x.sourceId === item.id);
      expect(p, item.id).toBeDefined();
      expect(p!.price).toBe(item.cost);
      expect(p!.currency).toBe('coin');
    }
  });

  it('همه‌ی کالاهای باغچه با همان قیمت و با شبنم', () => {
    for (const item of GARDEN_SHOP) {
      const p = PRODUCTS.find((x) => x.source === 'garden' && x.sourceId === item.id);
      expect(p, item.id).toBeDefined();
      expect(p!.price).toBe(item.cost);
      expect(p!.currency).toBe('dew');
    }
  });

  it('شناسه‌ها یکتا و هیچ دسته‌ای خالی نیست', () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const c of CATEGORIES) expect(productsIn(c.id).length, c.id).toBeGreaterThan(0);
  });

  it('کارگاهِ لوکوریان با گنج است و هنوز خریدنی نیست', () => {
    for (const p of productsIn('workshop')) {
      expect(p.currency).toBe('treasure');
      expect(p.source).toBe('soon');
    }
  });
});
