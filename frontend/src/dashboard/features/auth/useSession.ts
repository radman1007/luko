import { createContext, useContext } from 'react';
import type { Capability, Me } from '../../types';

export interface Session {
  me: Me | null;
  loading: boolean;
  can: (cap: Capability | 'superuser') => boolean;
  signedIn: (me: Me) => void;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider نیست');
  return ctx;
}
