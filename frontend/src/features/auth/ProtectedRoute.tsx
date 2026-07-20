import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { UserRole } from '@/types/user';
import { ROLE_HOME } from '@/types/user';
import { PageLoader } from '@/components/PageLoader/PageLoader';
import { useAuth } from './context';

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles = [] }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/'} replace />;
  }

  return children;
}
