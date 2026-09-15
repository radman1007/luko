import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineDevicePhoneMobile, HiOutlineLockClosed } from 'react-icons/hi2';
import { ROLE_HOME } from '@/types/user';
import type { UserRole } from '@/types/user';
import { useAuth } from '../../context';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { authApi } from '../../api';
import type { OtpSibling, VerifyOtpResult } from '../../api';
import { ALL_GRADES, OPEN_GRADES, gradeName } from '@/features/books/booksData';
import { enableGuestMode } from '../../guest';
import { OtpInput } from '../OtpInput/OtpInput';
import styles from './OtpAuthForm.module.css';

/** تا وقتی سرور طولِ واقعی را نگفته، همین را نشان می‌دهیم */
const DEFAULT_CODE_LENGTH = 5;

type Step = 'phone' | 'code' | 'pick' | 'password' | 'newPassword' | 'name' | 'grade';

/**
 * سه مسیر، هرکدام نوارِ گام‌های خودش:
 *   code     — ورودِ معمولی: شماره → کد
 *   password — راهِ جایگزین وقتی کد نمی‌رسد: شماره → رمز
 *   signup   — بارِ اول (یا ثبت‌نامِ نیمه‌کاره): شماره → کد → رمز → اسم → پایه
 */
type Path = 'code' | 'password' | 'signup';

/** آنچه سرور می‌گوید هنوز کم است */
interface Needs {
  password: boolean;
  profile: boolean;
}

function stepsFor(path: Path, entry: 'code' | 'password', needs: Needs) {
  const first: { key: Step; label: string }[] = [
    { key: 'phone', label: 'شماره' },
    entry === 'password' ? { key: 'password', label: 'رمز' } : { key: 'code', label: 'کد' },
  ];
  if (path !== 'signup') return first;
  return [
    ...first,
    ...(needs.password ? [{ key: 'newPassword' as Step, label: 'رمز' }] : []),
    ...(needs.profile
      ? [{ key: 'name' as Step, label: 'اسم' }, { key: 'grade' as Step, label: 'پایه' }]
      : []),
  ];
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

/**
 * ورود و ثبت‌نامِ بچه‌ها — همه‌چیز با کدِ پیامکی شروع می‌شود.
 *
 * بچه نمی‌داند «حساب دارم یا نه» و لازم هم نیست بداند: شماره را می‌زند و
 * کد را. سرور می‌گوید حساب کامل است (مستقیم به شهر) یا هنوز رمز و مشخصات
 * ندارد (بارِ اول، یا ثبت‌نامی که نیمه‌کاره مانده). رمز فقط راهِ جایگزین
 * است، برای وقتی که کد نمی‌رسد.
 */
export function OtpAuthForm() {
  const navigate = useNavigate();
  // پیامی که صفحه‌ی بازی هنگامِ فرستادنِ مهمان به اینجا همراه می‌کند
  const reason = (useLocation().state as { reason?: string } | null)?.reason;
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [path, setPath] = useState<Path>('code');
  const [entry, setEntry] = useState<'code' | 'password'>('code');
  const [needs, setNeeds] = useState<Needs>({ password: false, profile: false });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [grade, setGrade] = useState(1);
  const [siblings, setSiblings] = useState<OtpSibling[]>([]);
  const [ticket, setTicket] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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
  const goHome = (role: UserRole) => navigate(ROLE_HOME[role] ?? '/', { replace: true });

  /**
   * بعد از هر ورودِ موفق — با کد، با رمز یا از انتخابگر.
   * حسابِ کامل مستقیم به شهر می‌رود؛ حسابی که رمز یا اسم ندارد همین‌جا
   * ادامه می‌دهد. ترتیب همان قرارِ ثبت‌نام است: اول رمز، بعد مشخصات.
   */
  const afterSignIn = ({ user, needsPassword, needsProfile }: VerifyOtpResult) => {
    setUser(user);
    if (!needsPassword && !needsProfile) {
      goHome(user.role);
      return;
    }
    setNeeds({ password: needsPassword, profile: needsProfile });
    setFirstName(user.firstName ?? '');
    setGrade(user.grade && OPEN_GRADES.includes(user.grade) ? user.grade : 1);
    setPassword('');
    setError('');
    setPath('signup');
    setStep(needsPassword ? 'newPassword' : 'name');
  };

  /** شماره → کد. هم ورودِ معمولی است، هم شروعِ ثبت‌نام */
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
      setEntry('code');
      setPath('code');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'کد فرستاده نشد؛ شماره رو یه نگاه بنداز.'));
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
        setTicket(result.ticket);
        setStep('pick');
        return;
      }
      afterSignIn(result);
    } catch (err) {
      setCode('');
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده.'));
    } finally {
      setBusy(false);
    }
  };

  /** یکی از خواهر‌برادرهای هم‌شماره را انتخاب کرد */
  const pickSibling = async (userId: string) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      afterSignIn(await authApi.chooseOtpAccount({ ticket, userId }));
    } catch (err) {
      setError(errorMessage(err, 'انتخاب نشد؛ دوباره کد بگیر.'));
    } finally {
      setBusy(false);
    }
  };

  /** «با رمز میام تو» — برای وقتی که کد نمی‌رسد */
  const switchToPassword = () => {
    if (!phoneValid) {
      setError('اول شماره‌ت رو درست بزن.');
      return;
    }
    setError('');
    setPassword('');
    setEntry('password');
    setPath('password');
    setStep('password');
  };

  const loginWithPassword = async () => {
    if (!password || busy) return;
    setError('');
    setBusy(true);
    try {
      afterSignIn(await authApi.login({ phone, password }));
    } catch (err) {
      setError(errorMessage(err, 'شماره یا رمز درست نیست.'));
    } finally {
      setBusy(false);
    }
  };

  /** گامِ دومِ ثبت‌نام */
  const saveNewPassword = async () => {
    if (password.length < 6 || busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await authApi.setPassword(password);
      setUser(user);
      if (needs.profile) setStep('name');
      else goHome(user.role);
    } catch (err) {
      setError(errorMessage(err, 'رمز ذخیره نشد؛ یه رمزِ دیگه امتحان کن.'));
    } finally {
      setBusy(false);
    }
  };

  const goToGrade = () => {
    if (!firstName.trim()) return;
    setError('');
    setStep('grade');
  };

  /** گامِ آخر: اسم و پایه */
  const saveProfile = async () => {
    const name = firstName.trim();
    if (!name || busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await authApi.updateMe({ firstName: name, grade });
      setUser(user);
      goHome(user.role);
    } catch (err) {
      setError(errorMessage(err, 'ذخیره نشد؛ دوباره امتحان کن.'));
    } finally {
      setBusy(false);
    }
  };

  const changeNumber = () => {
    setStep('phone');
    setPath('code');
    setEntry('code');
    setCode('');
    setPassword('');
    setDevCode(undefined);
    setError('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'phone') void sendOtp();
    else if (step === 'code') void verify();
    else if (step === 'password') void loginWithPassword();
    else if (step === 'newPassword') void saveNewPassword();
    else if (step === 'name') goToGrade();
    else if (step === 'grade') void saveProfile();
  };

  const steps = stepsFor(path, entry, needs);
  const activeKey: Step = step === 'pick' ? 'code' : step;
  const activeIndex = steps.findIndex((s) => s.key === activeKey);

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
          <p className={styles.subtitle}>شماره‌ت رو بزن؛ یه کد برات می‌فرستم</p>

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
              onChange={(e) => { setPhone(normalizePhone(e.target.value)); if (error) setError(''); }}
              aria-label="شماره موبایل"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={!phoneValid || busy}>
            {busy ? 'یه لحظه…' : 'بفرست کد'}
          </button>

          <div className={styles.links}>
            <button type="button" className={styles.link} onClick={switchToPassword} disabled={busy}>
              <HiOutlineLockClosed aria-hidden />
              با رمز میام تو
            </button>
          </div>

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

      {step === 'code' && (
        <>
          <h1 className={styles.title}>کد رو بزن</h1>
          <p className={styles.subtitle}>
            برای <b dir="ltr" className={styles.phone}>{phone}</b> فرستادم
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
            {/* کد نرسید؟ رمز برای همین روزهاست */}
            <button type="button" className={styles.link} onClick={switchToPassword} disabled={busy}>
              <HiOutlineLockClosed aria-hidden />
              کد نیومد؟ با رمز بیا تو
            </button>
            <button type="button" className={styles.link} onClick={changeNumber}>
              <HiOutlineArrowLeft aria-hidden />
              تغییر شماره
            </button>
          </div>
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
                نیست. با کد می‌آیند تو، و اگر رمزشان گم شده والد از
                پنلِ خودش می‌بیندش. */}
            <button type="button" className={styles.link} onClick={() => void sendOtp()} disabled={busy}>
              <HiOutlineDevicePhoneMobile aria-hidden />
              با کدِ پیامکی بیا تو
            </button>
            <button type="button" className={styles.link} onClick={changeNumber}>
              <HiOutlineArrowLeft aria-hidden />
              تغییر شماره
            </button>
          </div>
        </>
      )}

      {step === 'newPassword' && (
        <>
          <h1 className={styles.title}>یه رمز برای خودت بذار</h1>
          <p className={styles.subtitle}>هر وقت کد نرسید، با شماره و همین رمز میای تو</p>

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
            {busy ? 'یه لحظه…' : needs.profile ? 'ذخیره و ادامه' : 'ذخیره و بریم تو شهر!'}
          </button>
        </>
      )}

      {step === 'name' && (
        <>
          <h1 className={styles.title}>اسمت چیه؟</h1>
          <p className={styles.subtitle}>بگو چی صدات کنیم</p>

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
            ادامه
          </button>
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
            {busy ? 'یه لحظه…' : 'بریم تو شهر!'}
          </button>

          <button type="button" className={styles.link} onClick={() => setStep('name')}>
            <HiOutlineArrowLeft aria-hidden />
            برگرد
          </button>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
