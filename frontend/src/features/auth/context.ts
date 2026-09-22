import { createContext, useContext } from 'react';
import type { User } from '@/types/user';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /**
   * توکن هست ولی اپ بی‌اینترنت و بی‌کاربرِ ذخیره‌شده باز شده؛ نشست باز است
   * و فقط باید منتظرِ اینترنت ماند — نه اینکه به صفحه‌ی ورود رفت.
   */
  offline: boolean;
  /** پرسیدنِ دوباره‌ی نشست (دکمه‌ی «دوباره امتحان کن») */
  retry: () => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
