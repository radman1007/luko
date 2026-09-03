export type UserRole = 'student' | 'parent' | 'teacher' | 'school_admin' | 'team_admin';

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  /** حالت مهمان: بدون حساب، داده‌ی دمو و سکه در localStorage */
  isGuest?: boolean;
}

/** مسیر پیش‌فرض هر نقش بعد از ورود */
export const ROLE_HOME: Record<UserRole, string> = {
  student: '/',
  parent: '/parent-panel',
  teacher: '/teacher-panel',
  school_admin: '/school-panel',
  team_admin: '/admin-panel',
};
