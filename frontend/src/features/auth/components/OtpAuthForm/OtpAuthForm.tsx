import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineDevicePhoneMobile, HiOutlineLockClosed } from 'react-icons/hi2';
import { ROLE_HOME } from '@/types/user';
import type { User } from '@/types/user';
import { useAuth } from '../../context';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { authApi } from '../../api';
import type { OtpSibling } from '../../api';
import { ALL_GRADES, OPEN_GRADES, gradeName } from '@/features/books/booksData';
import { enableGuestMode } from '../../guest';
import { OtpInput } from '../OtpInput/OtpInput';
import styles from './OtpAuthForm.module.css';

/** تا وقتی سرور طولِ واقعی را نگفته، همین را نشان می‌دهیم */
const DEFAULT_CODE_LENGTH = 5;

/**
 * گام‌های ورود.
 *
 * ثبت‌نام فعلاً تأییدِ شماره نمی‌خواهد: شماره → رمز، و تمام. کدِ یکبارمصرف
 * فقط برای «رمزم را فراموش کردم» می‌ماند.
 */
type Step = 'phone' | 'password' | 'newPassword' | 'code' | 'name' | 'grade' | 'pick';

/** نوارِ گام‌ها بسته به اینکه ورود است یا ثبت‌نام */
const STEPS_LOGIN: { key: Step; label: string }[] = [
  { key: 'phone', label: 'شماره' },
  { key: 'password', label: 'رمز' },
];
const STEPS_SIGNUP: { key: Step; label: string }[] = [
  { key: 'phone', label: 'شماره' },
  { key: 'name', label: 'اسم' },
  { key: 'grade', label: 'پایه' },
  { key: 'newPassword', label: 'رمز' },
];
/**
 * ورود با کدِ پیامکی.
 *
 * جای «رمزم را فراموش کردم» را گرفته: بچه‌ی کلاس‌اولی رمزِ تازه ساختن را
 * بلد نیست و اگر رمزش را گم کند، والدش از پنلِ خودش می‌بیندش. این‌جا فقط
 * راهِ ورود است، نه تغییرِ رمز.
 */
const STEPS_CODE: { key: Step; label: string }[] = [
  { key: 'phone', label: 'شماره' },
  { key: 'code', label: 'کد' },
];

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

/**
 * ورود و ثبت‌نامِ یکپارچه.
 *
 * بچه نمی‌داند «حساب دارم یا نه» — و لازم هم نیست بداند. شماره را می‌زند و
 * سرور می‌گوید گامِ بعدی «رمزت را بزن» است یا «بیا حسابت را بسازیم».
 * ثبت‌نام تأییدِ شماره نمی‌خواهد؛ کدِ یکبارمصرف فقط برای فراموشیِ رمز است.
 */
export function OtpAuthForm() {
  const navigate = useNavigate();
  // پیامی که صفحه‌ی بازی هنگامِ فرستادنِ مهمان به اینجا همراه می‌کند
  const reason = (useLocation().state as { reason?: string } | null)?.reason;
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState(1);
  const [siblings, setSiblings] = useState<OtpSibling[]>([]);
  const [ticket, setTicket] = useState('');
  /** ثبت‌نام یا فراموشیِ رمز — تعیین می‌کند نوارِ گام‌ها و متن‌ها چه بگویند */
  const [mode, setMode] = useState<'login' | 'signup' | 'code'>('login');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // بعد از ساختِ حساب نگه داشته می‌شود تا گامِ اسم بداند کجا برود
  const newUser = useRef<User | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'name') nameRef.current?.focus();
    if (step === 'password' || step === 'newPassword') passwordRef.current?.focus();
  }, [step]);

  const phoneValid = isValidPhone(phone);

  /** گامِ اول: این شماره حساب دارد یا باید ساخته شود؟ */
  const startAuth = async () => {
    if (!phoneValid || busy) return;
    setError('');
    setBusy(true);
    try {
      const { exists } = await authApi.start({ phone });
      if (exists) {
        setMode('login');
        setPassword('');
        setStep('password');
      } else {
        setMode('signup');
        setStep('name');
      }
    } catch (err) {
      setError(errorMessage(err, 'یک لحظه مشکل پیش آمد؛ دوباره امتحان کن.'));
    } finally {
      setBusy(false);
    }
  };

  /** ورود با رمز */
  const loginWithPassword = async () => {
    if (!password || busy) return;
    setError('');
    setBusy(true);
    try {
      const { user } = await authApi.login({ phone, password });
      setUser(user);
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'شماره یا رمز درست نیست.'));
      setBusy(false);
    }
  };

  /** گامِ اسم: فقط جلو می‌رویم؛ حساب بعد از انتخابِ پایه ساخته می‌شود */
  const goToGrade = () => {
    if (!firstName.trim()) return;
    setError('');
    setStep('grade');
  };

  /** پایه که مشخص شد، حساب ساخته می‌شود و بعد رمز می‌گیریم */
  const createAccount = async () => {
    const name = firstName.trim();
    if (!name || busy) return;
    setError('');
    setBusy(true);
    try {
      const { user } = await authApi.register({ phone, firstName: name, grade });
      setUser(user);
      newUser.current = user;
      setPassword('');
      setStep('newPassword');
    } catch (err) {
      setError(errorMessage(err, 'ساختِ حساب ناموفق بود؛ دوباره امتحان کن.'));
    } finally {
      setBusy(false);
    }
  };

  /** رمزِ تازه — هم گامِ آخرِ ثبت‌نام، هم پایانِ فراموشیِ رمز */
  const saveNewPassword = async () => {
    if (password.length < 6 || busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await authApi.setPassword(password);
      setUser(user);
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'رمز ذخیره نشد؛ یک رمزِ دیگر امتحان کن.'));
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!phoneValid || busy) return;
    setError('');
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone);
      setDevCode(res.devCode);
      setCodeLength(res.codeLength && res.codeLength > 0 ? res.codeLength : DEFAULT_CODE_LENGTH);
      setResendIn(res.resendIn);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'ارسال کد ناموفق بود؛ شماره را بررسی کن.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length < codeLength || busy) return;
    setError('');
    setBusy(true);
    try {
      const result = await authApi.verifyOtp({ phone, code: value });

      // چند بچه با یک شماره: کد نمی‌گوید کدام‌یک، پس خودش انتخاب می‌کند
      if (result.chooseFrom) {
        setSiblings(result.chooseFrom);
        setTicket(result.ticket ?? '');
        setStep('pick');
        return;
      }

      const user = result.user!;
      setUser(user);
      // ورود با کد یعنی همان ورود؛ رمزِ قبلی‌اش دست‌نخورده می‌ماند
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch (err) {
      setCode('');
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'phone') void startAuth();
    else if (step === 'password') void loginWithPassword();
    else if (step === 'name') goToGrade();
    else if (step === 'grade') void createAccount();
    else if (step === 'newPassword') void saveNewPassword();
    else void verify();
  };

  /** «با کدِ پیامکی وارد شو» — جایگزینِ فراموشیِ رمز برای بچه‌ها */
  const loginWithCode = () => {
    setMode('code');
    void sendOtp();
  };

  /** یکی از خواهر‌برادرهای هم‌شماره را انتخاب کرد */
  const pickSibling = async (userId: string) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await authApi.chooseOtpAccount({ ticket, userId });
      setUser(user);
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'انتخاب نشد؛ دوباره کد بگیر.'));
      setBusy(false);
    }
  };

  const changeNumber = () => {
    setStep('phone');
    setCode('');
    setPassword('');
    setMode('login');
    setDevCode(undefined);
    setError('');
  };

  const steps = mode === 'signup' ? STEPS_SIGNUP : mode === 'code' ? STEPS_CODE : STEPS_LOGIN;
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* نوارِ گام‌ها — بچه ببیند کجای کار است */}
      <ol className={styles.steps} aria-label="مرحله‌های ورود">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={i < activeIndex ? styles.stepDone : i === activeIndex ? styles.stepNow : styles.step}
          >
            <span className={styles.stepDot}>{(i + 1).toLocaleString('fa-IR')}</span>
            <span className={styles.stepLabel}>{s.label}</span>
          </li>
        ))}
      </ol>

      {step === 'phone' && (
        <>
          {reason && <p className={styles.reason}>{reason}</p>}
          <h1 className={styles.title}>بزن بریم تو شهرِ لوکو</h1>
          <p className={styles.subtitle}>شماره‌ت رو بزن؛ بقیه‌ش با من</p>

          <div className={styles.field}>
            <span className={styles.fieldIcon} aria-hidden>
              <HiOutlineDevicePhoneMobile />
            </span>
            <input
              className={styles.input}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(normalizePhone(e.target.value))}
              aria-label="شماره موبایل"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={!phoneValid || busy}>
            {busy ? 'یه لحظه…' : 'ادامه'}
          </button>

          <button
            type="button"
            className={styles.guest}
            onClick={() => {
              setUser(enableGuestMode());
              navigate('/', { replace: true });
            }}
          >
            فعلاً مهمون باشم
          </button>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 className={styles.title}>رمزت رو بزن</h1>
          <p className={styles.subtitle}>
            برای <b dir="ltr" className={styles.phone}>{phone}</b>
          </p>

          <div className={styles.field}>
            <span className={styles.fieldIcon} aria-hidden>
              <HiOutlineLockClosed />
            </span>
            <input
              ref={passwordRef}
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder="رمزِ عبور"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              aria-label="رمز عبور"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={!password || busy}>
            {busy ? 'در حال ورود…' : 'ورود'}
          </button>

          <div className={styles.links}>
            {/* بچه‌ها «فراموشیِ رمز» ندارند: رمزِ تازه ساختن کارِ آن‌ها
                نیست. با کدِ پیامکی می‌آیند تو، و اگر رمزشان گم شده والد
                از پنلِ خودش می‌بیندش. */}
            <button type="button" className={styles.link} onClick={loginWithCode} disabled={busy}>
              رمزت یادت رفته؟ با کدِ پیامکی بیا تو
            </button>
            <button type="button" className={styles.link} onClick={changeNumber}>
              <HiOutlineArrowLeft aria-hidden />
              تغییر شماره
            </button>
          </div>
        </>
      )}

      {step === 'grade' && (
        <>
          <h1 className={styles.title}>کلاس چندمی؟</h1>
          <p className={styles.subtitle}>بازی‌هایی که می‌بینی مالِ همین پایه‌ست</p>

          <div className={styles.grades}>
            {ALL_GRADES.map((g) => {
              const open = OPEN_GRADES.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  className={
                    !open ? styles.gradeSoon : g === grade ? styles.gradeOn : styles.grade
                  }
                  onClick={() => open && setGrade(g)}
                  aria-pressed={open ? g === grade : undefined}
                  aria-disabled={!open}
                  aria-label={open ? gradeName(g) : `${gradeName(g)}، به‌زودی`}
                >
                  <b>{gradeName(g)}</b>
                  {!open && <small>به‌زودی</small>}
                </button>
              );
            })}
          </div>

          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? 'یه لحظه…' : 'ادامه'}
          </button>

          <button type="button" className={styles.link} onClick={() => setStep('name')}>
            <HiOutlineArrowLeft aria-hidden />
            برگرد
          </button>
        </>
      )}

      {step === 'pick' && (
        <>
          <h1 className={styles.title}>کدومشون تویی؟</h1>
          <p className={styles.subtitle}>روی این شماره چند حساب هست</p>

          <div className={styles.picks}>
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.pick}
                onClick={() => void pickSibling(s.id)}
                disabled={busy}
              >
                <b>{s.firstName || 'بی‌اسم'}</b>
                <small>{gradeName(s.grade)}</small>
              </button>
            ))}
          </div>

          <button type="button" className={styles.link} onClick={changeNumber}>
            <HiOutlineArrowLeft aria-hidden />
            تغییر شماره
          </button>
        </>
      )}

      {step === 'newPassword' && (
        <>
          <h1 className={styles.title}>یه رمز برای خودت بذار</h1>
          <p className={styles.subtitle}>دفعه‌ی بعد با شماره و همین رمز وارد می‌شی</p>

          <div className={styles.field}>
            <span className={styles.fieldIcon} aria-hidden>
              <HiOutlineLockClosed />
            </span>
            <input
              ref={passwordRef}
              className={styles.input}
              type="password"
              autoComplete="new-password"
              placeholder="دستِ‌کم ۶ نویسه"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              aria-label="رمز تازه"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={password.length < 6 || busy}>
            {busy ? 'یه لحظه…' : 'ذخیره و بریم تو شهر!'}
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          <h1 className={styles.title}>کد رو بزن</h1>
          <p className={styles.subtitle}>
            {/* کد این‌جا فقط راهِ ورود است؛ رمزِ بچه دست‌نخورده می‌ماند */}
            برای <b dir="ltr" className={styles.phone}>{phone}</b> فرستادم؛ بزنش تا بریم تو
          </p>

          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError('');
            }}
            onComplete={(v) => void verify(v)}
            length={codeLength}
            disabled={busy}
            invalid={Boolean(error)}
          />

          {devCode && <p className={styles.devHint}>کدِ تست: {devCode}</p>}

          <button type="submit" className={styles.submit} disabled={busy || code.length < codeLength}>
            {busy ? 'در حال بررسی…' : 'تایید'}
          </button>

          <div className={styles.links}>
            <button
              type="button"
              className={styles.link}
              onClick={() => void sendOtp()}
              disabled={resendIn > 0 || busy}
            >
              {resendIn > 0
                ? `ارسال دوباره تا ${resendIn.toLocaleString('fa-IR')} ثانیه`
                : 'ارسال دوباره‌ی کد'}
            </button>
            <button type="button" className={styles.link} onClick={changeNumber}>
              <HiOutlineArrowLeft aria-hidden />
              تغییر شماره
            </button>
          </div>
        </>
      )}

      {step === 'name' && (
        <>
          <h1 className={styles.title}>اسمت چیه؟</h1>
          <p className={styles.subtitle}>حسابِ تازه می‌سازیم؛ فقط بگو چی صدات کنیم</p>

          <div className={styles.field}>
            <input
              ref={nameRef}
              className={styles.input}
              type="text"
              autoComplete="given-name"
              placeholder="مثلاً رادمان"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={30}
              aria-label="نام"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={!firstName.trim() || busy}>
            {busy ? 'یه لحظه…' : 'ادامه'}
          </button>

          <button type="button" className={styles.link} onClick={changeNumber}>
            <HiOutlineArrowLeft aria-hidden />
            تغییر شماره
          </button>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
