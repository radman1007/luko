import { api, send } from '../../lib/api';
import type { Me } from '../../types';

/** مرحله‌ی دوم لازم است: کدِ پیامکی رفته */
export interface LoginChallenge {
  challenge: string;
  phone: string;
  expiresIn: number;
  resendIn: number;
  devCode?: string;
}

/** وقتی کدِ پیامکی روی سرور خاموش است، همان مرحله‌ی رمز «من» را برمی‌گرداند */
export const needsCode = (res: LoginChallenge | Me): res is LoginChallenge => 'challenge' in res;

export const authApi = {
  login: (phone: string, password: string) =>
    send<LoginChallenge | Me>('post', 'auth/login', { phone, password }),
  verify: (challenge: string, code: string) => send<Me>('post', 'auth/verify', { challenge, code }),
  resend: (challenge: string) =>
    send<{ phone: string; expiresIn: number; resendIn: number; devCode?: string }>('post', 'auth/resend', { challenge }),
  csrf: () => api.get('auth/csrf'),
};
