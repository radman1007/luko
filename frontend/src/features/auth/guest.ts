import type { User } from '@/types/user';

// حالت مهمان (MVP): بدون حساب، داده‌ی دمو؛ پیشرفت فقط در localStorage
const GUEST_FLAG = 'luko_guest';
const PARENT_GUEST_FLAG = 'luko_parent_guest';

export const GUEST_USER: User = {
  id: 'guest',
  role: 'student',
  firstName: 'مهمان',
  lastName: '',
  isGuest: true,
};

/** حسابِ موقتِ والد برای دمو و نمایشگاه — هیچ رکوردی در سرور ساخته نمی‌شود. */
export const GUEST_PARENT_USER: User = {
  id: 'guest-parent',
  role: 'parent',
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

export function enableParentGuestMode(): User {
  localStorage.setItem(PARENT_GUEST_FLAG, '1');
  return GUEST_PARENT_USER;
}

export function disableParentGuestMode() {
  localStorage.removeItem(PARENT_GUEST_FLAG);
}

export function isParentGuestMode(): boolean {
  return localStorage.getItem(PARENT_GUEST_FLAG) === '1';
}
