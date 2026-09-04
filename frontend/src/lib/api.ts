import axios from 'axios';

// تنها نقطه‌ی ورود HTTP در کل اپ — هیچ کامپوننتی مستقیم fetch/axios صدا نمی‌زند.
// پیش‌فرض نسبی است تا در dev از پروکسی Vite و در production از nginx عبور کند.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * دو فضای ورودِ مستقل روی یک مرورگر.
 *
 * بیشترِ بچه‌ها با شماره‌ی پدر/مادرشان ثبت‌نام می‌کنند و اپ را روی همان
 * گوشی باز می‌گذارند. اگر توکن یک کلید مشترک داشت، ورودِ والد نشستِ بچه را
 * پاک می‌کرد (و برعکس) و وسطِ بازی بیرونش می‌انداخت. پس هر فضا توکنِ خودش
 * را دارد و هیچ‌کدام دیگری را نمی‌بیند.
 */
export type Audience = 'kid' | 'parent';

const TOKEN_KEYS: Record<Audience, string> = {
  // نامِ قدیمی عمداً دست‌نخورده مانده تا نشستِ بچه‌ها با این تغییر نپرد
  kid: 'luko_access_token',
  parent: 'luko_parent_access_token',
};

/** فضای هر مسیر. فقط پنل و ورودِ والدین فضای والد است. */
export function audienceForPath(pathname: string): Audience {
  return pathname.startsWith('/parent-panel') || pathname.startsWith('/parent-login')
    ? 'parent'
    : 'kid';
}

export function currentAudience(): Audience {
  return audienceForPath(window.location.pathname);
}

export const tokenStorage = {
  get: (audience: Audience = currentAudience()) =>
    localStorage.getItem(TOKEN_KEYS[audience]),
  set: (token: string, audience: Audience = currentAudience()) =>
    localStorage.setItem(TOKEN_KEYS[audience], token),
  clear: (audience: Audience = currentAudience()) =>
    localStorage.removeItem(TOKEN_KEYS[audience]),
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  // اگر صدازننده خودش توکن گذاشته (مثلاً هنگامِ بازیابیِ نشستِ یک فضای مشخص)
  // دست نمی‌زنیم؛ وگرنه توکنِ فضای مسیرِ فعلی می‌رود.
  if (!config.headers.Authorization) {
    const token = tokenStorage.get();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: وقتی بک‌اند refresh token داد، اینجا flow تمدید توکن اضافه شود
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      const audience = audienceForPath(path);

      // درخواستِ لینکِ بازی استثناست: ۴۰۱ آنجا یعنی «مهمانی و این مرحله
      // رایگان نیست»، نه «نشستت منقضی شد». صفحه‌ی بازی خودش با پیامِ درست
      // به ورود می‌برد، پس اینجا نه توکن پاک می‌شود نه ریدایرکتِ خشک.
      if (String(error.config?.url ?? '').includes('/play-link')) {
        return Promise.reject(error);
      }
      // فقط نشستِ همان فضا پاک می‌شود؛ منقضی‌شدنِ توکنِ والد نباید
      // بچه‌ای را که همان لحظه در حال بازی است بیرون بیندازد.
      tokenStorage.clear(audience);
      if (!path.startsWith('/login') && !path.startsWith('/parent-login')) {
        window.location.href = audience === 'parent' ? '/parent-login' : '/login';
      }
    }
    return Promise.reject(error);
  },
);
