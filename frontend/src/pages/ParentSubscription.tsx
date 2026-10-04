import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineShieldCheck,
  HiOutlineXCircle,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import { useAuth } from '@/features/auth/context';
import { ChildSwitch } from '@/features/parent/components/shell/ChildSwitch';
import { Sheet } from '@/features/parent/components/shell/Sheet';
import { GUEST_CHILDREN } from '@/features/parent/guestData';
import type { Child } from '@/features/parent/types';
import { useChildren } from '@/features/parent/useParent';
import { apiMessage, faNumber, toman } from '@/features/billing/format';
import type { ChildSubscription, Payment, Plan } from '@/features/billing/types';
import { useCheckout, usePayments, usePlans, useSubscriptions } from '@/features/billing/useBilling';
import panel from './ParentPanel.module.css';
import styles from './ParentSubscription.module.css';

/** قابِ پنلِ والدین (فونت و رنگ‌ها) + رنگ‌های طلاییِ اشتراک */
const APP_CLASS = `${panel.app} ${styles.app}`;

/** همان دو پلنِ سرور — فقط برای حالتِ مهمان که API ندارد */
const GUEST_PLANS: Plan[] = [
  { code: 'monthly', title: 'ماهانه', durationDays: 30, months: 1, priceToman: 299_000, perMonthToman: 299_000, savingPercent: 0 },
  { code: 'yearly', title: 'سالانه', durationDays: 365, months: 12, priceToman: 1_049_000, perMonthToman: 87_417, savingPercent: 71 },
];

const NO_PLANS: Plan[] = [];

const STATUS_ICON = {
  paid: HiOutlineCheckCircle,
  failed: HiOutlineXCircle,
  expired: HiOutlineClock,
  pending: HiOutlineClock,
};

function fullName(child?: Child): string {
  if (!child) return 'فرزند شما';
  return `${child.firstName} ${child.lastName}`.trim() || 'فرزند شما';
}

/** حلقه‌ی روزهای باقی‌مانده */
function DaysRing({ left, total }: { left: number; total: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, Math.max(0.03, left / total)) : 0;
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 108 108" aria-hidden>
        <circle className={styles.ringTrack} cx="54" cy="54" r={r} />
        <circle
          className={styles.ringValue}
          cx="54"
          cy="54"
          r={r}
          strokeDasharray={`${c * ratio} ${c}`}
        />
      </svg>
      <div className={styles.ringText}>
        <b>{faNumber(left)}</b>
        <small>روز مانده</small>
      </div>
    </div>
  );
}

function StatusHero({ sub, name }: { sub?: ChildSubscription; name: string }) {
  if (!sub || sub.status === 'free') {
    return (
      <section className={styles.hero} data-tone="free">
        <span className={styles.freeMark} aria-hidden>
          <CrownIcon size={30} />
        </span>
        <div className={styles.heroInfo}>
          <span className={styles.planChip}>پلنِ رایگان</span>
          <h2 className={styles.heroName}>{name}</h2>
          <p className={styles.heroText}>
            الان روی پلنِ رایگان است. یکی از پلن‌های زیر را انتخاب کنید؛ روزهای اشتراک از همین‌جا
            شمرده می‌شود و همه‌ی پیشرفتش همان‌طور می‌ماند.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.hero} data-tone={sub.expiringSoon ? 'warn' : 'active'}>
      <DaysRing left={sub.daysLeft} total={sub.totalDays} />
      <div className={styles.heroInfo}>
        <span className={styles.planChip}>
          <CrownIcon size={13} strokeWidth={2.2} aria-hidden />
          اشتراکِ {sub.planTitle}
        </span>
        <h2 className={styles.heroName}>{name}</h2>
        <p className={styles.heroText}>تا {sub.endsAtFa} فعال است.</p>
        {sub.expiringSoon && (
          <p className={styles.heroWarn}>
            <HiOutlineExclamationTriangle aria-hidden />
            کمتر از یک هفته مانده؛ برای قطع‌نشدن، تمدید کنید.
          </p>
        )}
      </div>
    </section>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const Icon = STATUS_ICON[payment.status] ?? HiOutlineClock;
  return (
    <li className={styles.payRow} data-status={payment.status}>
      <span className={styles.payIcon} aria-hidden>
        <Icon />
      </span>
      <div className={styles.payMain}>
        <b>اشتراکِ {payment.planTitle}</b>
        <small>{payment.paidAtFa || payment.createdAtFa}</small>
        {payment.status === 'paid' && (
          <small>
            تا {payment.endsAtFa}
            {payment.transId && <> · پیگیری <span dir="ltr">{payment.transId}</span></>}
          </small>
        )}
      </div>
      <div className={styles.payEnd}>
        <b>{toman(payment.amountToman)}</b>
        <span className={styles.statusChip}>{payment.statusLabel}</span>
      </div>
    </li>
  );
}

export default function ParentSubscription() {
  const { user, logout } = useAuth();
  const guest = Boolean(user?.isGuest);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const childrenQuery = useChildren(!guest);
  const childList = guest ? GUEST_CHILDREN : (childrenQuery.data ?? []);
  const subs = useSubscriptions(!guest);
  const plansQuery = usePlans(!guest);
  const plans = useMemo(() => (guest ? GUEST_PLANS : (plansQuery.data ?? NO_PLANS)), [guest, plansQuery.data]);

  const childId = params.get('child') ?? childList[0]?.id;
  const child = childList.find((item) => item.id === childId) ?? childList[0];
  const sub = subs.data?.find((item) => item.childId === child?.id);
  const payments = usePayments(child?.id, !guest && Boolean(child));
  const name = fullName(child);
  const shortName = child?.firstName?.trim() || name;

  const wantedPlan = params.get('plan');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [loginSheet, setLoginSheet] = useState(false);
  const checkout = useCheckout();
  const invoiceRef = useRef<HTMLElement>(null);

  // پلنِ پیش‌فرض: همانی که پیوند خواسته، وگرنه صورت‌حسابِ تمدید، وگرنه سالانه (به‌صرفه‌تر)
  const defaultPlan = wantedPlan ?? sub?.renewal?.planCode ?? plans.find((p) => p.savingPercent > 0)?.code ?? plans[0]?.code;
  const activePlan = plans.find((p) => p.code === (selected ?? defaultPlan));

  // از اعلانِ «رو به پایان» آمده: صورت‌حساب را جلوی چشم بیاور؛ ?pay=1 یعنی «تلاشِ دوباره»
  useEffect(() => {
    if (!sub || !wantedPlan) return;
    invoiceRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (params.get('pay') === '1') {
      setConfirmPlan(wantedPlan);
      const next = new URLSearchParams(params);
      next.delete('pay');
      setParams(next, { replace: true });
    }
    // فقط بارِ اولِ رسیدنِ داده
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.childId]);

  const confirmTarget = plans.find((p) => p.code === confirmPlan);
  const startsFrom = sub?.status === 'active' ? sub.endsAtFa : 'امروز';

  const switchChild = (id: string) => {
    setSelected(null);
    setParams({ child: id }, { replace: true });
  };

  const openConfirm = (code: string) => {
    if (guest) {
      setLoginSheet(true);
      return;
    }
    checkout.reset();
    setConfirmPlan(code);
  };

  const pay = () => {
    if (!child || !confirmTarget) return;
    checkout.mutate({ childId: child.id, plan: confirmTarget.code });
  };

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.durationDays - b.durationDays), [plans]);
  const loading = !guest && (childrenQuery.isLoading || subs.isLoading || plansQuery.isLoading);
  const loadError = !guest && (subs.isError || plansQuery.isError || childrenQuery.isError);

  return (
    <div className={APP_CLASS}>
      <header className={styles.bar}>
        <button type="button" className={styles.back} onClick={() => navigate('/parent-panel')} aria-label="بازگشت به پنل">
          <HiOutlineChevronRight aria-hidden />
        </button>
        <div className={styles.barTitle}>
          <b>اشتراک و صورت‌حساب</b>
          <small>{guest ? 'حالتِ مهمان — نمونه' : 'برای هر فرزند جداگانه'}</small>
        </div>
        <span className={styles.barSpacer} aria-hidden />
      </header>

      <main className={styles.main}>
        {childList.length > 1 && <ChildSwitch items={childList} activeId={child?.id} onChange={switchChild} />}

        {loading && (
          <div className={styles.skeleton} aria-hidden>
            <div className={styles.skelHero} />
            <div className={styles.skelCard} />
            <div className={styles.skelCard} />
          </div>
        )}

        {loadError && (
          <div className={styles.empty}>
            <b>اطلاعاتِ اشتراک بارگذاری نشد</b>
            <p>اتصال را بررسی کنید و دوباره تلاش کنید.</p>
            <button type="button" className={styles.btnGhost} onClick={() => { subs.refetch(); plansQuery.refetch(); childrenQuery.refetch(); }}>
              تلاشِ دوباره
            </button>
          </div>
        )}

        {!loading && !loadError && childList.length === 0 && (
          <div className={styles.empty}>
            <b>هنوز فرزندی اضافه نکرده‌اید</b>
            <p>اشتراک برای هر فرزند جداگانه است؛ اول فرزندتان را از پنل اضافه کنید.</p>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/parent-panel')}>
              بازگشت به پنل
            </button>
          </div>
        )}

        {!loading && !loadError && child && (
          <>
            <StatusHero sub={sub} name={name} />

            {sub?.renewal && (
              <section
                ref={invoiceRef}
                className={styles.invoice}
                data-urgent={sub.status === 'free' || sub.expiringSoon ? 'true' : undefined}
                aria-label="صورت‌حسابِ تمدید"
              >
                <header className={styles.invoiceHead}>
                  <span className={styles.invoiceIcon} aria-hidden>
                    <HiOutlineDocumentText />
                  </span>
                  <b>صورت‌حسابِ تمدید</b>
                  <span className={styles.invoiceTag}>
                    {sub.status === 'free' ? 'سررسید گذشته' : sub.expiringSoon ? 'سررسید نزدیک' : 'پیشنهادی'}
                  </span>
                </header>
                <dl className={styles.invoiceRows}>
                  <div>
                    <dt>پلن</dt>
                    <dd>اشتراکِ {sub.renewal.planTitle}</dd>
                  </div>
                  <div>
                    <dt>برای</dt>
                    <dd>{name}</dd>
                  </div>
                  <div>
                    <dt>شروع از</dt>
                    <dd>{sub.status === 'active' ? sub.renewal.startsFromFa : 'امروز'}</dd>
                  </div>
                  <div className={styles.invoiceTotal}>
                    <dt>مبلغِ قابلِ پرداخت</dt>
                    <dd>{toman(sub.renewal.amountToman)}</dd>
                  </div>
                </dl>
                <button type="button" className={styles.btnPrimary} onClick={() => openConfirm(sub.renewal!.planCode)}>
                  پرداخت و تمدید
                </button>
                <small className={styles.invoiceNote}>بر اساسِ آخرین پلنی که برای {shortName} خریده‌اید</small>
              </section>
            )}

            <section className={styles.section} aria-labelledby="plans-title">
              <h3 id="plans-title" className={styles.sectionTitle}>پلن‌های اشتراک</h3>
              <div className={styles.plans} role="radiogroup" aria-label="انتخابِ پلن">
                {sortedPlans.map((plan) => {
                  const isSelected = activePlan?.code === plan.code;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={styles.plan}
                      data-selected={isSelected ? 'true' : undefined}
                      data-best={plan.savingPercent > 0 ? 'true' : undefined}
                      onClick={() => setSelected(plan.code)}
                    >
                      {plan.savingPercent > 0 && (
                        <span className={styles.ribbon}>به‌صرفه‌ترین · {faNumber(plan.savingPercent)}٪ ارزان‌تر</span>
                      )}
                      <span className={styles.radio} aria-hidden />
                      <span className={styles.planName}>{plan.title}</span>
                      <span className={styles.planPrice}>
                        <b>{faNumber(plan.priceToman)}</b>
                        <small>تومان</small>
                      </span>
                      <span className={styles.planPer}>
                        {plan.months > 1 ? `ماهی حدودِ ${faNumber(plan.perMonthToman)} تومان` : 'هر ماه'}
                      </span>
                      <span className={styles.planDays}>{faNumber(plan.durationDays)} روز</span>
                    </button>
                  );
                })}
              </div>
              {activePlan && (
                <button type="button" className={styles.btnPrimary} onClick={() => openConfirm(activePlan.code)}>
                  {sub?.status === 'active' ? 'تمدید با' : 'خریدِ'} اشتراکِ {activePlan.title} · {toman(activePlan.priceToman)}
                </button>
              )}
              {sub?.status === 'active' && (
                <p className={styles.hint}>
                  تمدید پشتِ اشتراکِ فعلی می‌نشیند؛ روزهای باقی‌مانده از دست نمی‌رود.
                </p>
              )}
            </section>

            <section className={styles.section} aria-labelledby="history-title">
              <h3 id="history-title" className={styles.sectionTitle}>صورت‌حساب‌ها و پرداخت‌ها</h3>
              {guest || (payments.data?.length ?? 0) === 0 ? (
                <p className={styles.noPayments}>
                  {payments.isLoading ? 'در حالِ بارگذاری…' : `هنوز پرداختی برای ${shortName} ثبت نشده است.`}
                </p>
              ) : (
                <ul className={styles.history}>
                  {payments.data?.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </ul>
              )}
            </section>

            <p className={styles.secure}>
              <HiOutlineShieldCheck aria-hidden />
              پرداختِ امن با درگاهِ وندار (شاپرک). اطلاعاتِ کارت به لوکو نمی‌رسد.
            </p>
          </>
        )}
      </main>

      <Sheet open={Boolean(confirmTarget)} title="تأیید و پرداخت" onClose={() => setConfirmPlan(null)}>
        {confirmTarget && (
          <div className={styles.confirm}>
            <dl className={styles.invoiceRows}>
              <div>
                <dt>فرزند</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>پلن</dt>
                <dd>اشتراکِ {confirmTarget.title} · {faNumber(confirmTarget.durationDays)} روز</dd>
              </div>
              <div>
                <dt>شروع از</dt>
                <dd>{startsFrom}</dd>
              </div>
              <div className={styles.invoiceTotal}>
                <dt>مبلغ</dt>
                <dd>{toman(confirmTarget.priceToman)}</dd>
              </div>
            </dl>
            {checkout.isError && (
              <p className={styles.error} role="alert">
                {apiMessage(checkout.error, 'رفتن به درگاه انجام نشد؛ دوباره تلاش کنید.')}
              </p>
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={checkout.isPending || checkout.isSuccess}
              onClick={pay}
            >
              {checkout.isPending || checkout.isSuccess
                ? 'در حالِ انتقال به درگاه…'
                : `پرداختِ ${toman(confirmTarget.priceToman)}`}
            </button>
            <small className={styles.confirmNote}>
              به درگاهِ امنِ وندار می‌روید و بعد از پرداخت به همین پنل برمی‌گردید.
            </small>
          </div>
        )}
      </Sheet>

      <Sheet open={loginSheet} title="ورود لازم است" onClose={() => setLoginSheet(false)}>
        <div className={styles.confirm}>
          <p className={styles.loginText}>
            این صفحه نمونه است. برای خریدِ اشتراک، با شماره‌ی موبایلِ خودتان وارد پنلِ والدین شوید
            و فرزندتان را اضافه کنید.
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              logout();
              navigate('/parent-login');
            }}
          >
            ورود به حساب
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => setLoginSheet(false)}>
            بعداً
          </button>
        </div>
      </Sheet>
    </div>
  );
}
