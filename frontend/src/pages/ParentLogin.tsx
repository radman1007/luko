import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowRight,
  HiOutlineChartBarSquare,
  HiOutlineDevicePhoneMobile,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';
import { BrandMark } from '@/components/ui/icons';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/context';
import styles from './ParentLogin.module.css';

/** ارقام فارسی/عربی → انگلیسی، و حذفِ هر چیزِ غیررقم */
function digits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

const PROMISES = [
  { icon: HiOutlineChartBarSquare, text: 'گزارشِ هفتگی از تمرین و پیشرفتِ فرزندتان' },
  { icon: HiOutlineHeart, text: 'حال و روحیه‌اش را ببینید، بدونِ خواندنِ نوشته‌های خصوصی' },
  { icon: HiOutlineShieldCheck, text: 'هر عددی که می‌بینید از بازی‌های واقعیِ اوست' },
];

/**
 * ورودِ جداگانه‌ی والدین — فضای بزرگسال، نه طرحِ کودکانه‌ی اپِ دانش‌آموز.
 * ورود و ثبت‌نام یک مسیرند: شماره → کدِ پیامکی. حسابِ تازه با نقشِ `parent`
 * ساخته می‌شود تا مستقیم به پنل برود.
 */
export default function ParentLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const phoneValid = /^09\d{9}$/.test(phone);

  const sendCode = async () => {
    if (!phoneValid) {
      setError('شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone);
      setDevCode(res.devCode);
      setResendIn(res.resendIn);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'ارسال کد انجام نشد؛ چند لحظه بعد دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < 4) {
      setError('کد را کامل وارد کنید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { user } = await authApi.verifyOtp({
        phone,
        code,
        role: 'parent',
        firstName: firstName.trim() || undefined,
      });
      setUser(user);
      // اگر شماره از قبل حسابِ دانش‌آموز بوده، سرور نقشش را عوض نمی‌کند
      if (user.role !== 'parent') {
        setError('این شماره با حسابِ دانش‌آموز ثبت شده است. با شمارهٔ خودتان وارد شوید.');
        setBusy(false);
        return;
      }
      navigate('/parent-panel', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده است.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.head}>
          <span className={styles.logo} aria-hidden>
            <BrandMark size={24} />
          </span>
          <div>
            <h1 className={styles.title}>پنل والدین لوکو</h1>
            <p className={styles.subtitle}>
              {step === 'phone'
                ? 'با شمارهٔ موبایلتان وارد شوید'
                : `کد به ${phone} پیامک شد`}
            </p>
          </div>
        </header>

        {step === 'phone' ? (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <label className={styles.field}>
              شمارهٔ موبایل
              <span className={styles.inputWrap}>
                <HiOutlineDevicePhoneMobile aria-hidden />
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="09xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(digits(e.target.value).slice(0, 11))}
                  aria-invalid={Boolean(error) && !phoneValid}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || !phoneValid}>
              {busy ? 'در حال ارسال…' : 'ارسال کد'}
              <HiOutlineArrowRight aria-hidden />
            </button>

            <ul className={styles.promises}>
              {PROMISES.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <Icon aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </form>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <label className={styles.field}>
              کد تأیید
              <span className={styles.inputWrap}>
                <HiOutlineLockClosed aria-hidden />
                <input
                  ref={codeRef}
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="- - - - -"
                  className={styles.codeInput}
                  value={code}
                  onChange={(e) => setCode(digits(e.target.value).slice(0, 8))}
                />
              </span>
            </label>

            <label className={styles.field}>
              نام شما <small>(اگر برای اولین بار وارد می‌شوید)</small>
              <span className={styles.inputWrap}>
                <input
                  placeholder="مثلاً رادمان"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </span>
            </label>

            {devCode && <p className={styles.devCode}>کد توسعه: {devCode}</p>}
            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || code.length < 4}>
              {busy ? 'در حال بررسی…' : 'ورود به پنل'}
            </button>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setError('');
                }}
              >
                تغییر شماره
              </button>
              <button
                type="button"
                className={styles.link}
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
              >
                {resendIn > 0
                  ? `ارسال دوباره تا ${resendIn.toLocaleString('fa-IR')} ثانیه`
                  : 'ارسال دوبارهٔ کد'}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className={styles.foot}>
        این صفحه برای والدین است. اگر دانش‌آموزید،{' '}
        <a href="/login">از این‌جا وارد شوید</a>.
      </p>
    </main>
  );
}
