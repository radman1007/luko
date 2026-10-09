import { api, send } from '../../lib/api';
import type { Me } from '../../types';

export const authApi = {
  login: (phone: string, password: string) =>
    send<{ challenge: string; phone: string; expiresIn: number; resendIn: number; devCode?: string }>(
      'post', 'auth/login', { phone, password }),
  verify: (challenge: string, code: string) => send<Me>('post', 'auth/verify', { challenge, code }),
  resend: (challenge: string) =>
    send<{ phone: string; expiresIn: number; resendIn: number; devCode?: string }>('post', 'auth/resend', { challenge }),
  csrf: () => api.get('auth/csrf'),
};
