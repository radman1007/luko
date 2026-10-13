import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * اشتراک و پرداخت‌ها حالا بخشی از تنظیماتِ پنلِ والدین است
 * (features/parent/components/settings/BillingPage). این نشانیِ قدیمی در اعلان‌ها، پیام‌های تیم
 * و برگشت از درگاه هست؛ با همان فرزند و پلن به بخشِ تازه می‌رود.
 */
export default function ParentSubscription() {
  const [params] = useSearchParams();
  const next = new URLSearchParams({ p: 'settings', s: 'billing' });
  ['child', 'plan', 'pay'].forEach((key) => {
    const value = params.get(key);
    if (value) next.set(key, value);
  });
  return <Navigate to={`/parent-panel?${next.toString()}`} replace />;
}
