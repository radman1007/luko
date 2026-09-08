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

/**
 * توکنِ تمدید — چیزی که «دو هفته وارد بمان» به آن بسته است.
 *
 * توکنِ دسترسی نیم‌ساعته است؛ بدونِ تمدید، بچه وسطِ بازی بیرون می‌افتاد.
 * این‌جا هم مثلِ بالا هر فضا کلیدِ خودش را دارد تا نشستِ والد و بچه روی
 * یک گوشی به هم دست نزنند.
 */
const REFRESH_KEYS: Record<Audience, string> = {
  kid: 'luko_refresh_token',
  parent: 'luko_parent_refresh_token',
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
  clear: (audience: Audience = currentAudience()) => {
    localStorage.removeItem(TOKEN_KEYS[audience]);
    localStorage.removeItem(REFRESH_KEYS[audience]);
  },

  getRefresh: (audience: Audience = currentAudience()) =>
    localStorage.getItem(REFRESH_KEYS[audience]),
  setRefresh: (token: string, audience: Audience = currentAudience()) =>
    localStorage.setItem(REFRESH_KEYS[audience], token),
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

/**
 * تمدیدِ در جریان، به‌ازای هر فضا.
 *
 * چند درخواست می‌توانند هم‌زمان ۴۰۱ بگیرند؛ اگر هرکدام جدا تمدید می‌کرد،
 * هم چند بار به سرور می‌رفت و هم توکن‌های نیم‌کاره روی هم می‌نوشتند. پس
 * اولی تمدید می‌کند و بقیه به همان قول می‌چسبند.
 */
const renewing: Partial<Record<Audience, Promise<string | null>>> = {};

async function renewAccess(audience: Audience): Promise<string | null> {
  const refresh = tokenStorage.getRefresh(audience);
  if (!refresh) return null;

  // با axiosِ خام، وگرنه اینترسپتور روی خودش می‌افتد
  try {
    const { data } = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken: refresh },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    const token = data?.data?.accessToken as string | undefined;
    if (!token) return null;
    tokenStorage.set(token, audience);
    return token;
  } catch {
    return null;
  }
}

function renewOnce(audience: Audience): Promise<string | null> {
  if (!renewing[audience]) {
    renewing[audience] = renewAccess(audience).finally(() => {
      delete renewing[audience];
    });
  }
  return renewing[audience] as Promise<string | null>;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) return Promise.reject(error);

    const path = window.location.pathname;
    const audience = audienceForPath(path);
    const url = String(error.config?.url ?? '');

    // درخواستِ لینکِ بازی استثناست: ۴۰۱ آنجا یعنی «مهمانی و این مرحله
    // رایگان نیست»، نه «نشستت منقضی شد». صفحه‌ی بازی خودش با پیامِ درست
    // به ورود می‌برد، پس اینجا نه توکن پاک می‌شود نه ریدایرکتِ خشک.
    if (url.includes('/play-link')) return Promise.reject(error);

    // خودِ تمدید هم نباید دوباره تمدید شود
    const config = error.config ?? {};
    if (!config.__retried && !url.includes('/auth/refresh')) {
      const token = await renewOnce(audience);
      if (token) {
        config.__retried = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return apiClient(config);
      }
    }

    // تمدید نشد: نشست واقعاً تمام است (یا از دستگاهِ دیگری وارد شده‌اند).
    // فقط نشستِ همان فضا پاک می‌شود؛ منقضی‌شدنِ توکنِ والد نباید بچه‌ای
    // را که همان لحظه در حال بازی است بیرون بیندازد.
    tokenStorage.clear(audience);
    if (!path.startsWith('/login') && !path.startsWith('/parent-login')) {
      window.location.href = audience === 'parent' ? '/parent-login' : '/login';
    }
    return Promise.reject(error);
  },
);
