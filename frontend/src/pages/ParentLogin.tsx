import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowRight,
  HiOutlineChartBarSquare,
  HiOutlineDevicePhoneMobile,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
  HiOutlineUser,
} from 'react-icons/hi2';
import { BrandMark } from '@/components/ui/icons';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { authApi } from '@/features/auth/api';
import type { VerifyOtpResult } from '@/features/auth/api';
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

const PHONE_HINT = 'شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';

type Step = 'phone' | 'code' | 'password' | 'newPassword' | 'name';

/**
 * ورودِ جداگانه‌ی والدین — فضای بزرگسال، نه طرحِ کودکانه‌ی اپِ دانش‌آموز.
 *
 * ورود و ثبت‌نام یک مسیرند و هر دو با کدِ پیامکی شروع می‌شوند. بارِ اول:
 * شماره → کد (تأییدِ شماره) → رمز → نام. بعد از آن فقط کد. ورود با رمز
 * راهِ جایگزین است برای وقتی که پیامک نمی‌رسد؛ «فراموشیِ رمز» با کد وارد
 * می‌شود و رمزِ تازه می‌سازد.
 */
export default function ParentLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // طولِ کد را سرور می‌گوید؛ سخت‌کد کردنش با عوض‌شدنِ پنلِ پیامک می‌شکست
  const [codeLength, setCodeLength] = useState(5);
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  /** «رمز را فراموش کرده‌ام»: بعد از کد، رمزِ تازه اجباری است */
  const [resetting, setResetting] = useState(false);
  const [devCode, setDevCode] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
    if (step === 'password' || step === 'newPassword') passwordRef.current?.focus();
    if (step === 'name') nameRef.current?.focus();
  }, [step]);

  const phoneValid = isValidPhone(phone);
  const openPanel = () => navigate('/parent-panel', { replace: true });

  /**
   * بعد از هر ورودِ موفق. حسابِ کامل مستقیم به پنل می‌رود؛ حسابِ تازه یا
   * نیمه‌کاره اول رمز می‌گذارد و بعد نام. در «فراموشیِ رمز» رمزِ تازه
   * اجباری است حتی اگر حساب رمز داشته باشد.
   */
  const afterSignIn = (
    { user, needsPassword, needsProfile: profile }: VerifyOtpResult,
    forcePassword = false,
  ) => {
    setUser(user);
    setNeedsProfile(profile);
    setFirstName(user.firstName ?? '');
    setPassword('');
    setError('');
    if (needsPassword || forcePassword) setStep('newPassword');
    else if (profile) setStep('name');
    else openPanel();
  };

  const sendCode = async (reset = false) => {
    if (!phoneValid) {
      setError(PHONE_HINT);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone);
      setCodeLength(res.codeLength && res.codeLength > 0 ? res.codeLength : 5);
      setDevCode(res.devCode);
      setResendIn(res.resendIn);
      setCode('');
      setResetting(reset);
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
      const result = await authApi.verifyOtp({ phone, code, role: 'parent' });
      // والد انتخابگر ندارد (یک شماره = یک والد)؛ این شاخه فقط برای کاملیِ نوع است
      if (result.chooseFrom) {
        setError('یک لحظه مشکل پیش آمد؛ دوباره تلاش کنید.');
        return;
      }
      afterSignIn(result, resetting);
    } catch (err) {
      setCode('');
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده است.'));
    } finally {
      setBusy(false);
    }
  };

  const switchToPassword = () => {
    if (!phoneValid) {
      setError(PHONE_HINT);
      return;
    }
    setError('');
    setPassword('');
    setStep('password');
  };

  const loginWithPassword = async () => {
    if (!password) return;
    setError('');
    setBusy(true);
    try {
      afterSignIn(await authApi.login({ phone, password, role: 'parent' }));
    } catch (err) {
      setError(errorMessage(err, 'شماره یا رمز درست نیست.'));
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
      setUser(await authApi.setPassword(password));
      if (needsProfile) setStep('name');
      else openPanel();
    } catch (err) {
      setError(errorMessage(err, 'رمز ذخیره نشد؛ رمز دیگری امتحان کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    const name = firstName.trim();
    if (!name) {
      setError('نامتان را بنویسید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      setUser(await authApi.updateMe({ firstName: name }));
      openPanel();
    } catch (err) {
      setError(errorMessage(err, 'ذخیره نشد؛ دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const backToPhone = () => {
    setStep('phone');
    setCode('');
    setPassword('');
    setResetting(false);
    setError('');
  };

  const subtitle =
    step === 'phone'
      ? 'با شمارهٔ موبایلتان وارد شوید؛ کد تأیید پیامک می‌شود'
      : step === 'code'
        ? `کد به ${phone} پیامک شد`
        : step === 'password'
          ? `ورود با رمز — ${phone}`
          : step === 'newPassword'
            ? (resetting ? 'رمز تازه‌ای بسازید' : 'یک رمز برای حسابتان بگذارید')
            : 'آخرین قدم: نام شما';

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.head}>
          <span className={styles.logo} aria-hidden>
            <BrandMark size={24} />
          </span>
          <div>
            <h1 className={styles.title}>پنل والدین لوکو</h1>
            <p className={styles.subtitle}>{subtitle}</p>
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
                  onChange={(e) => { setPhone(normalizePhone(e.target.value)); if (error) setError(''); }}
                  aria-invalid={Boolean(error) && !phoneValid}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || !phoneValid}>
              {busy ? 'یک لحظه…' : 'دریافت کد تأیید'}
              <HiOutlineArrowRight aria-hidden />
            </button>

            <div className={styles.actions}>
              <button type="button" className={styles.link} onClick={switchToPassword} disabled={busy}>
                ورود با رمز عبور
              </button>
            </div>

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
        ) : step === 'code' ? (
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
                  onChange={(e) => { setCode(digits(e.target.value).slice(0, codeLength)); if (error) setError(''); }}
                />
              </span>
            </label>

            {devCode && <p className={styles.devCode}>کد توسعه: {devCode}</p>}
            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || code.length < codeLength}>
              {busy ? 'در حال بررسی…' : 'تأیید کد'}
            </button>

            <div className={styles.actions}>
              <button type="button" className={styles.link} onClick={backToPhone}>
                تغییر شماره
              </button>
              <button
                type="button"
                className={styles.link}
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode(resetting)}
              >
                {resendIn > 0
                  ? `ارسال دوباره تا ${resendIn.toLocaleString('fa-IR')} ثانیه`
                  : 'ارسال دوبارهٔ کد'}
              </button>
              {/* در «فراموشیِ رمز» برگشتن به ورود با رمز معنایی ندارد */}
              {!resetting && (
                <button type="button" className={styles.link} onClick={switchToPassword} disabled={busy}>
                  کد نرسید؟ ورود با رمز عبور
                </button>
              )}
            </div>
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
              <button type="button" className={styles.link} onClick={backToPhone}>
                تغییر شماره
              </button>
              <button type="button" className={styles.link} disabled={busy} onClick={() => void sendCode()}>
                ورود با کد پیامکی
              </button>
              <button type="button" className={styles.link} disabled={busy} onClick={() => void sendCode(true)}>
                رمز را فراموش کرده‌اید؟
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
            <p className={styles.guestHint}>
              ورود همیشه با کد پیامکی است؛ این رمز برای وقتی است که پیامک نرسد.
            </p>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || password.length < 6}>
              {busy ? 'در حال ذخیره…' : needsProfile ? 'ذخیره و ادامه' : 'ذخیره و ورود به پنل'}
            </button>
          </form>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}
          >
            <label className={styles.field}>
              نام شما
              <span className={styles.inputWrap}>
                <HiOutlineUser aria-hidden />
                <input
                  ref={nameRef}
                  autoComplete="name"
                  placeholder="مثلاً رادمان"
                  value={firstName}
                  maxLength={60}
                  onChange={(e) => { setFirstName(e.target.value); if (error) setError(''); }}
                />
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.primary} disabled={busy || !firstName.trim()}>
              {busy ? 'در حال ذخیره…' : 'ذخیره و ورود به پنل'}
            </button>
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
