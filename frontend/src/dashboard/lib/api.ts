import axios, { AxiosError } from 'axios';
import { API_BASE } from './base';

/**
 * تنها کلاینتِ HTTPِ داشبورد. جدا از `src/lib/api.ts`ِ اپ است چون این‌جا نشستِ جنگو
 * (کوکیِ httpOnly + CSRF) کار می‌کند نه JWT، و هیچ توکنی در حافظه‌ی مرورگر نمی‌ماند.
 */
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: { 'Content-Type': 'application/json' },
});

/** نشست تمام شد (بی‌کاری، خروج از جای دیگر): برنامه به صفحه‌ی ورود برمی‌گردد */
export const SESSION_LOST = 'luko-dash:session-lost';

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = String(error.config?.url ?? '');
    if (error.response?.status === 401 && !url.startsWith('auth/') && url !== 'me') {
      window.dispatchEvent(new CustomEvent(SESSION_LOST, { detail: messageOf(error) }));
    }
    return Promise.reject(error);
  },
);

export function messageOf(error: unknown, fallback = 'کار انجام نشد؛ دوباره تلاش کنید.'): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (message) return message;
    if (!error.response) return 'به سرور وصل نشد؛ اینترنت را بررسی کنید.';
    if (error.response.status >= 500) return 'سرور خطا داد؛ کمی بعد دوباره تلاش کنید.';
  }
  return fallback;
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params });
  return data.data as T;
}

export async function send<T>(method: 'post' | 'patch' | 'delete', url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const { data } = await api.request({
    method,
    url,
    data: body,
    headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data.data as T;
}

/** پیش از اولین POST: کوکیِ csrftoken را بگیر */
export async function ensureCsrf(): Promise<void> {
  if (document.cookie.includes('csrftoken=')) return;
  await api.get('auth/csrf');
}
