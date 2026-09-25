import { apiClient } from '@/lib/api';

/** یک کلیدِ هم‌رسان‌شده. `value` همان رشته‌ی localStorage است؛ null یعنی پاک شده. */
export interface SyncItem {
  key: string;
  value: string | null;
  version: number;
}

export interface SyncChange {
  key: string;
  value: string | null;
  /** نسخه‌ای از سرور که این دستگاه دیده؛ نوشتن فقط روی همان پذیرفته می‌شود */
  baseVersion: number;
}

export const syncApi = {
  /** کلیدهایی که بعد از `since` عوض شده‌اند (بی since: همه) */
  async pull(since: string | null): Promise<{ since: string; items: SyncItem[] }> {
    const { data } = await apiClient.get('/sync', { params: since ? { since } : undefined });
    return data.data;
  },

  /**
   * سکه‌ای که سرور خودش برای این حساب ثبت کرده (از بُردِ مرحله‌ها). فقط برای
   * حسابی که هنوز کیفِ هم‌رسان‌شده ندارد نقطه‌ی شروع است.
   */
  async accountCoins(): Promise<number> {
    const { data } = await apiClient.get('/users/me/profile');
    const coins = Number(data.data?.coins);
    return Number.isInteger(coins) && coins >= 0 ? coins : 0;
  },

  /** `token` برای ارسالِ آخر هنگامِ خروج، وقتی توکنِ نشست دیگر در حافظه نیست */
  async push(
    changes: SyncChange[],
    token?: string,
  ): Promise<{ applied: Array<{ key: string; version: number }>; conflicts: SyncItem[] }> {
    const { data } = await apiClient.post(
      '/sync',
      { changes },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    );
    return data.data;
  },
};
