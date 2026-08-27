import { apiClient, tokenStorage } from '@/lib/api';
import type { Audience } from '@/lib/api';
import type { User } from '@/types/user';

export interface RequestOtpResult {
  /** اعتبارِ کد (ثانیه) */
  expiresIn: number;
  /** تا ارسالِ مجدد (ثانیه) */
  resendIn: number;
  /** فقط در حالتِ توسعه: کدِ تست */
  devCode?: string;
}

export interface VerifyOtpPayload {
  phone: string;
  code: string;
  firstName?: string;
  lastName?: string;
  /**
   * نقشِ حساب. سرور فقط `parent` و `student` را می‌پذیرد و نقش را جزوِ
   * جستجو حساب می‌کند: یک شماره می‌تواند هم حسابِ دانش‌آموز داشته باشد و
   * هم حسابِ والد، و ورود از هر صفحه به حسابِ خودش می‌رسد.
   */
  role?: 'parent' | 'student';
}

export interface VerifyOtpResult {
  user: User;
  /** حسابِ تازه ساخته شد؟ */
  isNew: boolean;
}

export const authApi = {
  /** گام ۱: ارسالِ رمزِ یکبارمصرف به شماره */
  async requestOtp(phone: string): Promise<RequestOtpResult> {
    const { data } = await apiClient.post('/auth/request-otp', { phone });
    return data.data;
  },

  /** گام ۲: بررسیِ کد؛ اگر حساب نبود ساخته می‌شود */
  async verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post('/auth/verify-otp', payload);
    // توکن در فضای همان نقش می‌نشیند تا ورودِ والد نشستِ بچه را پاک نکند
    const audience: Audience = payload.role === 'parent' ? 'parent' : 'kid';
    tokenStorage.set(data.data.accessToken, audience);
    return { user: data.data.user, isNew: data.data.isNew };
  },

  /** توکن صریح فرستاده می‌شود تا بازیابیِ نشست به مسیرِ لحظه‌ی درخواست وابسته نباشد */
  async getCurrentUser(audience?: Audience): Promise<User> {
    const token = audience ? tokenStorage.get(audience) : null;
    const { data } = await apiClient.get('/auth/me',
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    return data.data;
  },

  logout(audience?: Audience) {
    tokenStorage.clear(audience);
  },
};
