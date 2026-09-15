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
  /**
   * ثبت‌نام کجا مانده. بارِ اول، بعد از تأییدِ شماره، هنوز رمز و مشخصات
   * ندارد؛ حسابی که نیمه‌کاره رها شده هم با همین‌ها از همان‌جا ادامه می‌دهد.
   */
  needsPassword: boolean;
  needsProfile: boolean;
}

/** یکی از چند بچه‌ی هم‌شماره، در گامِ انتخاب */
export interface OtpSibling {
  id: string;
  firstName: string;
  grade: number;
}

/**
 * پاسخِ تأییدِ کد.
 *
 * روی شماره‌ای که چند بچه دارد، کد نمی‌گوید کدام‌یک؛ به‌جای توکن یک
 * فهرست و یک بلیتِ کوتاه‌عمر می‌آید تا خودش انتخاب کند.
 */
export type VerifyOtpOutcome =
  | (VerifyOtpResult & { chooseFrom?: undefined; ticket?: undefined })
  | { chooseFrom: OtpSibling[]; ticket: string };

export interface AuthPayload {
  phone: string;
  role?: 'parent' | 'student';
}

/**
 * نشست را می‌نشاند: توکنِ دسترسی، توکنِ تمدید، و پایان دادن به حالتِ مهمان.
 *
 * بدونِ توکنِ تمدید نشست بعدِ نیم ساعت تمام می‌شد؛ و بدونِ برداشتنِ پرچمِ
 * مهمان، اپ همچنان مهمان حسابش می‌کرد و نه پیشرفت با سرور همگام می‌شد
 * نه تکمیلِ بازی‌ها به پنلِ والدین می‌رسید.
 */
function storeSession(data: { accessToken: string; refreshToken?: string }, audience: Audience) {
  tokenStorage.set(data.accessToken, audience);
  if (data.refreshToken) tokenStorage.setRefresh(data.refreshToken, audience);
  if (audience === 'parent') disableParentGuestMode();
  else disableGuestMode();
}

/** پاسخِ هر ورودِ موفق — با کد، با رمز یا از انتخابگر — به یک شکل */
function toResult(data: {
  user: User;
  isNew?: boolean;
  needsPassword?: boolean;
  needsProfile?: boolean;
}): VerifyOtpResult {
  return {
    user: data.user,
    isNew: Boolean(data.isNew),
    needsPassword: Boolean(data.needsPassword),
    needsProfile: Boolean(data.needsProfile),
  };
}

export const authApi = {
  /** ورود با رمز — راهِ جایگزین وقتی کدِ پیامکی نمی‌رسد */
  async login(payload: AuthPayload & { password: string }): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post('/auth/login', payload);
    storeSession(data.data, payload.role === 'parent' ? 'parent' : 'kid');
    return toResult(data.data);
  },

  /** گذاشتنِ رمز — گامِ دومِ ثبت‌نام، یا رمزِ تازه بعد از فراموشی */
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

  /** گام ۲: بررسیِ کد — هم ورود است هم شروعِ ثبت‌نامِ حسابِ تازه */
  async verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpOutcome> {
    const { data } = await apiClient.post('/auth/verify-otp', payload);
    // چند بچه با یک شماره: هنوز واردِ هیچ حسابی نشده‌ایم
    if (data.data.chooseFrom) {
      return { chooseFrom: data.data.chooseFrom, ticket: data.data.ticket };
    }
    const audience: Audience = payload.role === 'parent' ? 'parent' : 'kid';
    storeSession(data.data, audience);
    return toResult(data.data);
  },

  /** گامِ بعدِ انتخابگر: با بلیت، واردِ حسابِ انتخاب‌شده می‌شویم */
  async chooseOtpAccount(payload: { ticket: string; userId: string }): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post('/auth/otp-choose', payload);
    storeSession(data.data, 'kid');
    return toResult(data.data);
  },

  /** مشخصات — گامِ آخرِ ثبت‌نام. پایه فقط برای دانش‌آموز معنا دارد. */
  async updateMe(payload: { firstName: string; lastName?: string; grade?: number }): Promise<User> {
    const { data } = await apiClient.patch('/auth/me', payload);
    return data.data;
  },

  /** توکن صریح فرستاده می‌شود تا بازیابیِ نشست به مسیرِ لحظه‌ی درخواست وابسته نباشد */
  async getCurrentUser(audience?: Audience): Promise<User> {
    const token = audience ? tokenStorage.get(audience) : null;
    const { data } = await apiClient.get('/auth/me',
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    return data.data;
  },

  /**
   * خروج.
   *
   * به سرور هم خبر می‌دهد، وگرنه نشست آن‌طرف باز می‌ماند: بچه دو هفته
   * وارد می‌ماند و توکنِ refreshِ باقی‌مانده تا آخرِ همان دو هفته حساب را
   * باز می‌کرد — یعنی «خروج» فقط این گوشی را پاک می‌کرد، نه نشست را.
   *
   * توکنِ refresh فرستاده می‌شود، نه هدرِ Authorization: عمرِ access نیم
   * ساعت است و اگر منقضی باشد سرور پیش از اجرای خروج ۴۰۱ می‌داد و نشست
   * تا دو هفته زنده می‌ماند. refresh همان چیزی است که آن دو هفته را
   * می‌دهد، پس بستنِ نشست با آن انجام می‌شود.
   *
   * منتظرِ پاسخ نمی‌مانیم و خطایش را هم می‌بلعیم: کاربر باید خارج شود حتی
   * اگر اینترنت قطع باشد. توکن پیش از پاک شدن برداشته می‌شود چون درخواست
   * از همان حافظه می‌خواندش.
   */
  logout(audience?: Audience) {
    const refreshToken = tokenStorage.getRefresh(audience);
    if (refreshToken) {
      void apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    tokenStorage.clear(audience);
  },
};
