import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiMessage, faNumber, toman } from '../format';
import { goToGateway } from '../gateway';

describe('قیمت‌ها', () => {
  it('رقم و جداکننده‌ی فارسی', () => {
    expect(faNumber(299_000)).toBe('۲۹۹٬۰۰۰');
    expect(toman(1_049_000)).toBe('۱٬۰۴۹٬۰۰۰ تومان');
  });

  it('پیامِ خطای پاکتِ API، وگرنه پیامِ پیش‌فرض', () => {
    const error = { response: { data: { error: { code: 503, message: 'درگاه در دسترس نیست' } } } };
    expect(apiMessage(error, 'x')).toBe('درگاه در دسترس نیست');
    expect(apiMessage(new Error('network'), 'دوباره تلاش کنید')).toBe('دوباره تلاش کنید');
  });
});

describe('رفتن به درگاه', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('پیوند با referrerpolicy فقط-دامنه کلیک می‌شود (سیاستِ سایت same-origin است)', () => {
    const clicked: Array<{ href: string; referrerPolicy: string; rel: string }> = [];
    const link = {
      href: '', referrerPolicy: '', rel: '', style: {} as Record<string, string>,
      click() { clicked.push({ href: this.href, referrerPolicy: this.referrerPolicy, rel: this.rel }); },
      remove: vi.fn(),
    };
    const appended: unknown[] = [];
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild: (el: unknown) => appended.push(el) },
    });
    goToGateway('https://ipg.vandar.io/v4/abc');
    expect(clicked).toEqual([{ href: 'https://ipg.vandar.io/v4/abc', referrerPolicy: 'strict-origin-when-cross-origin', rel: 'external' }]);
    // «noreferrer» Referer را می‌بُرد و وندار صفحه‌ی خطا نشان می‌داد
    expect(clicked[0].rel).not.toContain('noreferrer');
    expect(link.remove).toHaveBeenCalled();
    expect(appended).toHaveLength(1);
  });
});
