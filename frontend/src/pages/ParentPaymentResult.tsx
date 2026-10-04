import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HiOutlineCheck,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { billingApi } from '@/features/billing/api';
import { toman } from '@/features/billing/format';
import { billingKeys } from '@/features/billing/useBilling';
import { parentKeys } from '@/features/parent/useParent';
import base from './ParentSubscription.module.css';
import styles from './ParentPaymentResult.module.css';

/** تا این مدت نتیجه‌ی «در انتظار» را دوباره می‌پرسیم (وندار تا ۲۰ دقیقه تأیید می‌پذیرد) */
const POLL_FOR_MS = 90 * 1000;

/**
 * بازگشت از درگاه. وضعیت را فقط سرور می‌گوید (پس از تأیید با وندار)؛
 * پارامترهای نشانی هیچ‌وقت به‌تنهایی «موفق» حساب نمی‌شوند.
 */
export default function ParentPaymentResult() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const id = Number(params.get('payment'));
  const unknown = !id || params.get('error');
  const startedAt = useRef(Date.now());
  const [gaveUp, setGaveUp] = useState(false);

  const payment = useQuery({
    queryKey: billingKeys.payment(id),
    queryFn: () => billingApi.payment(id, true),
    enabled: !unknown,
    retry: 2,
    refetchInterval: (query) => {
      if (query.state.data?.status !== 'pending') return false;
      return Date.now() - startedAt.current < POLL_FOR_MS ? 3000 : false;
    },
  });

  const status = payment.data?.status;
  useEffect(() => {
    if (status && status !== 'pending') {
      // وضعیتِ نوار، صورت‌حساب‌ها و اعلانِ «فعال شد» تازه شوند
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: parentKeys.notifications });
    }
    if (status === 'pending') {
      const timer = window.setTimeout(() => setGaveUp(true), POLL_FOR_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [status, queryClient]);

  const data = payment.data;
  const subscriptionPath = data?.childId ? `/parent-panel/subscription?child=${data.childId}` : '/parent-panel/subscription';
  const tone = unknown || payment.isError ? 'failed' : !data || status === 'pending' ? 'pending' : status === 'paid' ? 'paid' : 'failed';

  let title = 'در حالِ بررسیِ پرداخت…';
  let text = 'پرداخت را با درگاه تأیید می‌کنیم؛ چند ثانیه صبر کنید.';
  if (unknown || payment.isError) {
    title = 'این پرداخت پیدا نشد';
    text = 'اگر مبلغی از حسابتان کم شده، نتیجه تا چند دقیقه‌ی دیگر در صورت‌حساب‌ها ثبت می‌شود.';
  } else if (status === 'paid' && data) {
    title = 'پرداخت موفق بود';
    text = `اشتراکِ ${data.planTitle} ${data.childName} فعال شد.`;
  } else if ((status === 'failed' || status === 'expired') && data) {
    title = status === 'expired' ? 'مهلتِ پرداخت تمام شد' : 'پرداخت انجام نشد';
    text = 'اگر مبلغی از حسابتان کم شده، بانک حداکثر تا ۷۲ ساعت آن را برمی‌گرداند.';
  } else if (status === 'pending' && gaveUp) {
    title = 'پرداخت در حالِ تأیید است';
    text = 'نتیجه تا چند دقیقه‌ی دیگر در صورت‌حساب‌ها ثبت می‌شود؛ لازم نیست دوباره پرداخت کنید.';
  }

  const Icon = tone === 'paid' ? HiOutlineCheck : tone === 'failed' ? HiOutlineXMark : HiOutlineClock;

  return (
    <div className={base.app}>
      <header className={base.bar}>
        <button type="button" className={base.back} onClick={() => navigate('/parent-panel')} aria-label="بازگشت به پنل">
          <HiOutlineChevronRight aria-hidden />
        </button>
        <div className={base.barTitle}>
          <b>نتیجه‌ی پرداخت</b>
          <small>اشتراکِ لوکو</small>
        </div>
        <span className={base.barSpacer} aria-hidden />
      </header>

      <main className={base.main}>
        <section className={styles.card} data-tone={tone} role="status" aria-live="polite">
          <span className={styles.mark} aria-hidden>
            <Icon />
          </span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.text}>{text}</p>
          {data?.message && tone === 'failed' && <p className={styles.reason}>{data.message}</p>}
        </section>

        {data && status === 'paid' && (
          <section className={base.invoice} aria-label="رسیدِ پرداخت">
            <dl className={base.invoiceRows}>
              <div>
                <dt>فرزند</dt>
                <dd>{data.childName}</dd>
              </div>
              <div>
                <dt>پلن</dt>
                <dd>اشتراکِ {data.planTitle}</dd>
              </div>
              <div>
                <dt>اعتبار تا</dt>
                <dd>{data.endsAtFa}</dd>
              </div>
              {data.transId && (
                <div>
                  <dt>کدِ پیگیری</dt>
                  <dd dir="ltr">{data.transId}</dd>
                </div>
              )}
              {data.cardNumber && (
                <div>
                  <dt>کارت</dt>
                  <dd dir="ltr">{data.cardNumber}</dd>
                </div>
              )}
              <div>
                <dt>شماره‌ی فاکتور</dt>
                <dd dir="ltr">{data.factorNumber}</dd>
              </div>
              <div>
                <dt>زمان</dt>
                <dd>{data.paidAtFa}</dd>
              </div>
              <div className={base.invoiceTotal}>
                <dt>مبلغ</dt>
                <dd>{toman(data.amountToman)}</dd>
              </div>
            </dl>
          </section>
        )}

        <div className={styles.actions}>
          {tone === 'failed' && data && (
            <button
              type="button"
              className={base.btnPrimary}
              onClick={() => {
                const retry = new URLSearchParams({ plan: data.planCode, pay: '1' });
                if (data.childId) retry.set('child', data.childId);
                navigate(`/parent-panel/subscription?${retry.toString()}`);
              }}
            >
              تلاشِ دوباره
            </button>
          )}
          {tone === 'paid' && (
            <button type="button" className={base.btnPrimary} onClick={() => navigate('/parent-panel')}>
              بازگشت به پنل
            </button>
          )}
          <button type="button" className={base.btnGhost} onClick={() => navigate(subscriptionPath)}>
            مشاهده‌ی اشتراک و صورت‌حساب‌ها
          </button>
        </div>
      </main>
    </div>
  );
}
