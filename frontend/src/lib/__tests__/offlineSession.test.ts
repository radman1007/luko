/**
 * نشستِ بچه بی‌اینترنت نمی‌پرد.
 *
 * قبلاً هر خطای تمدید — حتی قطعیِ شبکه — «نشست تمام شد» حساب می‌شد و توکن
 * پاک می‌شد؛ اپِ اندروید بی‌اینترنت بچه را بیرون می‌انداخت. فقط ردِ صریحِ
 * سرور باید نشست را ببندد.
 */
import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const location = { pathname: '/', href: '/' };

async function freshApi() {
  vi.resetModules();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { location });
  location.pathname = '/';
  location.href = '/';
  localStorage.setItem('luko_access_token', 'old-access');
  localStorage.setItem('luko_refresh_token', 'refresh');
  localStorage.setItem('luko_session_user', JSON.stringify({ id: '7', role: 'student', firstName: 'آرش', lastName: '' }));
  const axios = (await import('axios')).default;
  const api = await import('../api');
  return { axios, api };
}

function reply(config: InternalAxiosRequestConfig, status: number) {
  const response = { data: {}, status, statusText: '', headers: {}, config };
  return Promise.reject(new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, response));
}

function offline(config: InternalAxiosRequestConfig) {
  return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config, null, undefined));
}

describe('خطای شبکه نشست را نمی‌بندد', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('isTransientError: بی‌پاسخ، ۵xx و ۴۲۹ گذرا‌اند؛ ۴۰۱ و ۴۰۳ نه', async () => {
    const { api } = await freshApi();
    const cfg = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const withStatus = (status?: number) =>
      new AxiosError('x', 'E', cfg, null, status ? { data: {}, status, statusText: '', headers: {}, config: cfg } : undefined);
    expect(api.isTransientError(withStatus())).toBe(true);
    expect(api.isTransientError(withStatus(502))).toBe(true);
    expect(api.isTransientError(withStatus(429))).toBe(true);
    expect(api.isTransientError(withStatus(401))).toBe(false);
    expect(api.isTransientError(withStatus(403))).toBe(false);
    expect(api.isTransientError(new Error('plain'))).toBe(false);
  });

  it('۴۰۱ و تمدیدِ بی‌اینترنت: توکن و کاربر می‌مانند و خطا «نامعلوم» علامت می‌خورد', async () => {
    const { axios, api } = await freshApi();
    api.apiClient.defaults.adapter = ((config) => reply(config, 401)) as AxiosAdapter;
    axios.defaults.adapter = ((config) => offline(config)) as AxiosAdapter; // خودِ تمدید

    const error = await api.apiClient.get('/games/completed').catch((e) => e);
    expect(api.isTransientError(error)).toBe(true);
    expect(localStorage.getItem('luko_access_token')).toBe('old-access');
    expect(localStorage.getItem('luko_refresh_token')).toBe('refresh');
    expect(api.tokenStorage.getUser('kid')?.id).toBe('7');
    expect(location.href).toBe('/');
  });

  it('تمدیدِ رد‌شده از سرور: نشست واقعاً بسته می‌شود و به ورود می‌رود', async () => {
    const { axios, api } = await freshApi();
    api.apiClient.defaults.adapter = ((config) => reply(config, 401)) as AxiosAdapter;
    axios.defaults.adapter = ((config) => reply(config, 401)) as AxiosAdapter;

    const error = await api.apiClient.get('/games/completed').catch((e) => e);
    expect(api.isTransientError(error)).toBe(false);
    expect(localStorage.getItem('luko_access_token')).toBeNull();
    expect(api.tokenStorage.getUser('kid')).toBeNull();
    expect(location.href).toBe('/login');
  });

  it('تمدیدِ موفق: درخواست با توکنِ تازه تکرار می‌شود', async () => {
    const { axios, api } = await freshApi();
    api.apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      String(config.headers.Authorization) === 'Bearer new-access'
        ? Promise.resolve({ data: { data: { ok: true } }, status: 200, statusText: '', headers: {}, config })
        : reply(config, 401)) as AxiosAdapter;
    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.resolve({ data: { data: { accessToken: 'new-access' } }, status: 200, statusText: '', headers: {}, config })) as AxiosAdapter;

    const res = await api.apiClient.get('/games/completed');
    expect(res.data.data.ok).toBe(true);
    expect(localStorage.getItem('luko_access_token')).toBe('new-access');
  });

  it('درخواستِ بی‌اینترنت (بی‌پاسخ) اصلاً به تمدید و خروج نمی‌رسد', async () => {
    const { axios, api } = await freshApi();
    const refresh = vi.fn((config: InternalAxiosRequestConfig) => reply(config, 401));
    api.apiClient.defaults.adapter = ((config) => offline(config)) as AxiosAdapter;
    axios.defaults.adapter = refresh as unknown as AxiosAdapter;

    const error = await api.apiClient.get('/auth/me').catch((e) => e);
    expect(api.isTransientError(error)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(localStorage.getItem('luko_access_token')).toBe('old-access');
  });
});
