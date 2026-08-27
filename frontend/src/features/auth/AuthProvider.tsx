import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { User } from '@/types/user';
import { audienceForPath, tokenStorage } from '@/lib/api';
import type { Audience } from '@/lib/api';
import { AuthContext } from './context';
import { authApi } from './api';
import { GUEST_USER, disableGuestMode, isGuestMode } from './guest';

type Sessions = Record<Audience, User | null>;

/**
 * دو نشستِ مستقل روی یک مرورگر: بچه و والد.
 *
 * چون بچه‌ها معمولاً با شماره‌ی پدر/مادر ثبت‌نام می‌کنند و اپ روی همان گوشی
 * باز می‌ماند، این دو نباید هم را قطع کنند. هر فضا توکن، کاربر و خروجِ
 * خودش را دارد؛ `useAuth` همیشه نشستِ فضای مسیرِ فعلی را برمی‌گرداند.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const audience = audienceForPath(pathname);

  const [sessions, setSessions] = useState<Sessions>({ kid: null, parent: null });
  const [ready, setReady] = useState<Record<Audience, boolean>>({ kid: false, parent: false });
  // از دوباره‌کاری در StrictMode و در هر بار جابه‌جاییِ مسیر جلوگیری می‌کند
  const started = useRef<Partial<Record<Audience, boolean>>>({});

  useEffect(() => {
    if (started.current[audience]) return;
    started.current[audience] = true;

    const token = tokenStorage.get(audience);
    if (token) {
      authApi
        .getCurrentUser(audience)
        .then((user) => setSessions((s) => ({ ...s, [audience]: user })))
        .catch(() => tokenStorage.clear(audience))
        .finally(() => setReady((r) => ({ ...r, [audience]: true })));
      return;
    }
    // حالت مهمان فقط برای بچه‌هاست؛ پنل والدین همیشه ورودِ واقعی می‌خواهد
    if (audience === 'kid' && isGuestMode()) {
      setSessions((s) => ({ ...s, kid: GUEST_USER }));
    }
    setReady((r) => ({ ...r, [audience]: true }));
  }, [audience]);

  const setUser = useCallback(
    (user: User | null) => setSessions((s) => ({ ...s, [audience]: user })),
    [audience],
  );

  const logout = useCallback(() => {
    authApi.logout(audience);
    if (audience === 'kid') disableGuestMode();
    setSessions((s) => ({ ...s, [audience]: null }));
  }, [audience]);

  const value = useMemo(
    () => ({ user: sessions[audience], loading: !ready[audience], setUser, logout }),
    [sessions, ready, audience, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
