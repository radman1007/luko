import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/types/user';
import { tokenStorage } from '@/lib/api';
import { AuthContext } from './context';
import { authApi } from './api';
import { GUEST_USER, disableGuestMode, isGuestMode } from './guest';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tokenStorage.get()) {
      authApi
        .getCurrentUser()
        .then(setUser)
        .catch(() => tokenStorage.clear())
        .finally(() => setLoading(false));
      return;
    }
    if (isGuestMode()) {
      setUser(GUEST_USER);
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    disableGuestMode();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, setUser, logout }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
