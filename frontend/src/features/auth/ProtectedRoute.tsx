import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { UserRole } from '@/types/user';
import { ROLE_HOME } from '@/types/user';
import { PageLoader } from '@/components/PageLoader/PageLoader';
import { audienceForPath } from '@/lib/api';
import { useAuth } from './context';

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles = [] }: Props) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <PageLoader />;
  if (!user) {
    // نشستِ هر فضا جداست: بچه‌ای که همین حالا لاگین است دسترسیِ پنل نمی‌دهد،
    // و والد به ورودِ خودش می‌رود نه لاگینِ کودکانه.
    const target = audienceForPath(pathname) === 'parent' ? '/parent-login' : '/login';
    return <Navigate to={target} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/'} replace />;
  }

  return children;
}
