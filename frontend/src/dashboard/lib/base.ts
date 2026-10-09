/**
 * نشانیِ داشبورد روی سرور بلند و پنهان است و در هیچ فایلی از این بسته نیامده؛
 * از خودِ نشانیِ صفحه خوانده می‌شود: «/<مسیرِ پنهان>/...». API هم زیرِ همان است.
 */
export function dashboardBase(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  return first && first !== 'dashboard.html' ? `/${first}` : '/dash-local';
}

export const BASE = typeof window === 'undefined' ? '/dash-local' : dashboardBase(window.location.pathname);
export const API_BASE = `${BASE}/api`;
