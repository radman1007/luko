import type { User } from '@/types/user';

// حالت مهمان (MVP): بدون حساب، داده‌ی دمو؛ پیشرفت فقط در localStorage
const GUEST_FLAG = 'luko_guest';

export const GUEST_USER: User = {
  id: 'guest',
  role: 'student',
  firstName: 'مهمان',
  lastName: '',
  isGuest: true,
};

export function enableGuestMode(): User {
  localStorage.setItem(GUEST_FLAG, '1');
  return GUEST_USER;
}

export function disableGuestMode() {
  localStorage.removeItem(GUEST_FLAG);
}

export function isGuestMode(): boolean {
  return localStorage.getItem(GUEST_FLAG) === '1';
}
