import { apiClient, tokenStorage } from '@/lib/api';
import { disableGuestMode, disableParentGuestMode } from './guest';
import type { Audience } from '@/lib/api';
import type { User } from '@/types/user';

export interface RequestOtpResult {
  /** اعتبارِ کد (ثانیه) */
  expiresIn: number;
  /** تا ارسالِ مجدد (ثانیه) */
  resendIn: number;
  /**
   * چند رقم است. سرور می‌گوید چون پنل‌های پیامک طولِ یکسانی ندارند —
   * ملی‌پیامک خودش کد را می‌سازد و ممکن است بلندتر از قبلی باشد.
   */
  codeLength?: number;
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

export interface StartResult {
  /** این شماره حسابِ رمزدار دارد؟ */
  exists: boolean;
}

export interface AuthPayload {
  phone: string;
  role?: 'parent' | 'student';
}

export const authApi = {
  /** گامِ اول: این شماره حساب دارد یا باید ساخته شود؟ */
  async start(payload: AuthPayload): Promise<StartResult> {
    const { data } = await apiClient.post('/auth/start', payload);
    return data.data;
  },

  /** ثبت‌نام بدونِ تأییدِ شماره — حساب ساخته و همان‌جا وارد می‌شود */
  async register(payload: AuthPayload & { firstName?: string }): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post('/auth/register', payload);
    const audience: Audience = payload.role === 'parent' ? 'parent' : 'kid';
    tokenStorage.set(data.data.accessToken, audience);
    if (audience === 'parent') disableParentGuestMode();
    else disableGuestMode();
    return { user: data.data.user, isNew: data.data.isNew };
  },

  /** ورود با شماره و رمز */
  async login(payload: AuthPayload & { password: string }): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post('/auth/login', payload);
    const audience: Audience = payload.role === 'parent' ? 'parent' : 'kid';
    tokenStorage.set(data.data.accessToken, audience);
    if (audience === 'parent') disableParentGuestMode();
    else disableGuestMode();
    return { user: data.data.user, isNew: false };
  },

  /** گذاشتن یا عوض‌کردنِ رمز (نیازمندِ ورود) */
  async setPassword(password: string): Promise<User> {
    const { data } = await apiClient.post('/auth/set-password', { password });
    return data.data;
  },

  /** تأییدِ اختیاریِ شماره با کدِ یکبارمصرف */
  async verifyPhone(code: string): Promise<User> {
    const { data } = await apiClient.post('/auth/verify-phone', { code });
    return data.data;
  },
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
    // حالا حسابِ واقعی دارد. بدونِ این، پرچمِ مهمان می‌ماند و اپ همچنان
    // مهمان حسابش می‌کرد: نه پیشرفت با سرور همگام می‌شد و نه تکمیلِ
    // بازی‌ها به پنل والدین می‌رسید.
    if (audience === 'parent') disableParentGuestMode();
    else disableGuestMode();
    return { user: data.data.user, isNew: data.data.isNew };
  },

  /** توکن صریح فرستاده می‌شود تا بازیابیِ نشست به مسیرِ لحظه‌ی درخواست وابسته نباشد */
  /** تکمیلِ نام بعد از ثبت‌نام — گامِ آخرِ ورود با پیامک */
  async updateMe(payload: { firstName: string; lastName?: string }): Promise<User> {
    const { data } = await apiClient.patch('/auth/me', payload);
    return data.data;
  },

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
