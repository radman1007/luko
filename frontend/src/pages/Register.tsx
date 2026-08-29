import { Navigate } from 'react-router-dom';

/**
 * ثبت‌نامِ جدا دیگر وجود ندارد: ورود و ثبت‌نام یک مسیر شده‌اند و اگر
 * حساب نباشد همان‌جا ساخته می‌شود. این مسیر فقط لینک‌های قدیمی را نگه
 * می‌دارد تا نشکنند.
 */
export default function Register() {
  return <Navigate to="/login" replace />;
}
