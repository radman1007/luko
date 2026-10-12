import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/context';
import { goftinoSupported, identifyGoftinoUser, loadGoftino, removeGoftino } from './goftino';

/**
 * گفتینو فقط در پنلِ والدین (والدِ واردشده یا مهمانِ دمو). جابه‌جایی بینِ صفحه‌های پنل
 * ویجت را دوباره بار نمی‌کند؛ بیرون رفتن از پنل آن را کامل برمی‌دارد.
 */
export function GoftinoChat() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const active = goftinoSupported() && pathname.startsWith('/parent-panel') && user?.role === 'parent';

  useEffect(() => {
    if (!active) return undefined;
    loadGoftino();
    return removeGoftino;
  }, [active]);

  const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const known = active && user && !user.isGuest;
  useEffect(() => {
    if (!known) return;
    identifyGoftinoUser({ name: name || 'والد', phone: user?.phone, about: 'والد در پنلِ لوکو', tags: 'والد' });
  }, [known, name, user?.phone]);

  return null;
}
