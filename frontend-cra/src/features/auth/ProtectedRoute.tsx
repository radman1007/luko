import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { UserRole } from 'types/user';
import { ROLE_HOME } from 'types/user';
import { PageLoader } from 'components/PageLoader/PageLoader';
import { isGuestParentPreview } from 'features/parent/demoMode';
import { useAuth } from './context';

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles = [] }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // ⚠️ موقتی: مهمان برای تست، پنل والدین را با داده‌ی نمونه می‌بیند.
  // با false کردنِ GUEST_PARENT_PREVIEW در features/parent/demoMode.ts برمی‌گردد.
  const guestPreview = allowedRoles.includes('parent') && isGuestParentPreview();

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role) && !guestPreview) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/'} replace />;
  }

  return children;
}
