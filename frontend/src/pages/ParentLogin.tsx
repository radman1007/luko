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
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/context';
import { enableParentGuestMode, GUEST_PARENT_USER } from '@/features/auth/guest';
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

  const [step, setStep] = useState<'phone' | 'password' | 'newPassword' | 'name' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // طولِ کد را سرور می‌گوید؛ سخت‌کد کردنش با عوض‌شدنِ پنلِ پیامک می‌شکست
  const [codeLength, setCodeLength] = useState(5);
  const [firstName, setFirstName] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  /** ثبت‌نام یا بازیابیِ رمز — متن‌ها و مقصدِ گام‌ها را تعیین می‌کند */
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
    if (step === 'password' || step === 'newPassword') passwordRef.current?.focus();
  }, [step]);

  const phoneValid = isValidPhone(phone);

  /** گامِ اول: این شماره حسابِ والد دارد یا باید ساخته شود؟ */
  const startAuth = async () => {
    if (!phoneValid) {
      setError('شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { exists } = await authApi.start({ phone, role: 'parent' });
      setMode(exists ? 'login' : 'signup');
      setPassword('');
      setStep(exists ? 'password' : 'name');
    } catch (err) {
      setError(errorMessage(err, 'یک لحظه مشکل پیش آمد؛ دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const loginWithPassword = async () => {
    if (!password) return;
    setError('');
    setBusy(true);
    try {
      const { user } = await authApi.login({ phone, password, role: 'parent' });
      setUser(user);
      navigate('/parent-panel', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'شماره یا رمز درست نیست.'));
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setError('');
    setBusy(true);
    try {
      const { user } = await authApi.register({
        phone, role: 'parent', firstName: firstName.trim() || undefined,
      });
      setUser(user);
      setPassword('');
      setStep('newPassword');
    } catch (err) {
      setError(errorMessage(err, 'ساخت حساب انجام نشد؛ دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async () => {
    if (password.length < 6) {
      setError('رمز باید دست‌کم ۶ نویسه باشد.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const user = await authApi.setPassword(password);
      setUser(user);
      navigate('/parent-panel', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'رمز ذخیره نشد؛ رمز دیگری امتحان کنید.'));
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!phoneValid) {
      setError('شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone);
      setCodeLength(res.codeLength && res.codeLength > 0 ? res.codeLength : 5);
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
    if (code.length < codeLength) {
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
      // حسابِ والدِ همین شماره؛ حتی اگر بچه با همین شماره حساب داشته باشد و
      // همین حالا روی این گوشی لاگین باشد، نشستش دست‌نخورده می‌ماند.
      // نقشِ والد هیچ‌وقت انتخابگر نمی‌گیرد (یک شماره = یک والد)، ولی
      // تایپ اجازه‌ی undefined می‌دهد چون همان مسیر برای بچه‌ها هم هست.
      setUser(user ?? null);
      // این مسیر فقط بازیابیِ رمز است: کد که درست بود، رمزِ تازه می‌سازد
      setPassword('');
      setStep('newPassword');
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
                : step === 'password'
                  ? `رمز حساب ${phone}`
                  : step === 'newPassword'
                    ? (mode === 'reset' ? 'رمز تازه‌ای بسازید' : 'یک رمز برای حسابتان بگذارید')
                    : step === 'name'
                      ? 'حساب تازه می‌سازیم'
                      : `کد به ${phone} پیامک شد`}
            </p>
          </div>
        </header>

        {step === 'phone' ? (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void startAuth();
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
                  onChange={(e) => setPhone(normalizePhone(e.target.value))}
                  aria-invalid={Boolean(error) && !phoneValid}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || !phoneValid}>
              {busy ? 'یک لحظه…' : 'ادامه'}
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

            <div className={styles.guestDivider}>
              <span>یا برای نمایش سریع</span>
            </div>
            <button
              type="button"
              className={styles.guestButton}
              onClick={() => {
                enableParentGuestMode();
                setUser(GUEST_PARENT_USER);
                navigate('/parent-panel', { replace: true });
              }}
            >
              ورود به‌عنوان مهمان
            </button>
            <p className={styles.guestHint}>بدون پیامک؛ با داده‌های نمونه و مناسبِ دمو</p>
          </form>
        ) : step === 'password' ? (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); void loginWithPassword(); }}
          >
            <label className={styles.field}>
              رمز عبور
              <span className={styles.inputWrap}>
                <HiOutlineLockClosed aria-hidden />
                <input
                  ref={passwordRef}
                  type="password"
                  autoComplete="current-password"
                  placeholder="رمز حسابتان"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || !password}>
              {busy ? 'در حال ورود…' : 'ورود به پنل'}
            </button>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.link}
                onClick={() => { setStep('phone'); setPassword(''); setError(''); }}
              >
                تغییر شماره
              </button>
              <button
                type="button"
                className={styles.link}
                disabled={busy}
                onClick={() => { setMode('reset'); void sendCode(); }}
              >
                رمزتان را فراموش کرده‌اید؟ با کد پیامکی وارد شوید
              </button>
            </div>
          </form>
        ) : step === 'name' ? (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); void createAccount(); }}
          >
            <label className={styles.field}>
              نام شما
              <span className={styles.inputWrap}>
                <input
                  placeholder="مثلاً رادمان"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? 'یک لحظه…' : 'ادامه'}
            </button>

            <div className={styles.actions}>
              <button type="button" className={styles.link}
                onClick={() => { setStep('phone'); setError(''); }}>
                تغییر شماره
              </button>
            </div>
          </form>
        ) : step === 'newPassword' ? (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); void saveNewPassword(); }}
          >
            <label className={styles.field}>
              رمز عبور <small>(دست‌کم ۶ نویسه)</small>
              <span className={styles.inputWrap}>
                <HiOutlineLockClosed aria-hidden />
                <input
                  ref={passwordRef}
                  type="password"
                  autoComplete="new-password"
                  placeholder="رمزی که یادتان می‌ماند"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || password.length < 6}>
              {busy ? 'در حال ذخیره…' : 'ذخیره و ورود به پنل'}
            </button>
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
                  placeholder={'- '.repeat(codeLength).trim()}
                  className={styles.codeInput}
                  value={code}
                  onChange={(e) => setCode(digits(e.target.value).slice(0, codeLength))}
                />
              </span>
            </label>

            {devCode && <p className={styles.devCode}>کد توسعه: {devCode}</p>}
            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || code.length < codeLength}>
              {busy ? 'در حال بررسی…' : 'تأیید کد'}
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
