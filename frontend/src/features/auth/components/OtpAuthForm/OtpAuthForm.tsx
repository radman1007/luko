import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineDevicePhoneMobile } from 'react-icons/hi2';
import { ROLE_HOME } from '@/types/user';
import type { User } from '@/types/user';
import { useAuth } from '../../context';
import { authApi } from '../../api';
import { enableGuestMode } from '../../guest';
import { OtpInput } from '../OtpInput/OtpInput';
import styles from './OtpAuthForm.module.css';

/** تا وقتی سرور طولِ واقعی را نگفته، همین را نشان می‌دهیم */
const DEFAULT_CODE_LENGTH = 5;

/** گام‌های ورود. `name` فقط وقتی می‌آید که حساب همان لحظه ساخته شده باشد. */
type Step = 'phone' | 'code' | 'name';

const STEPS: { key: Step; label: string }[] = [
  { key: 'phone', label: 'شماره' },
  { key: 'code', label: 'کد' },
  { key: 'name', label: 'اسم' },
];

/** ارقام فارسی/عربی → انگلیسی و حذفِ غیررقم */
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

/**
 * ورود و ثبت‌نامِ یکپارچه.
 *
 * بچه نمی‌داند «حساب دارم یا نه» — و لازم هم نیست بداند. همیشه شماره را
 * می‌زند و کد را تأیید می‌کند؛ اگر حساب داشت همان‌جا وارد می‌شود و اگر
 * نداشت سرور می‌سازدش و فقط آن‌وقت اسمش پرسیده می‌شود.
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
  const [devCode, setDevCode] = useState<string | undefined>();
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // بعد از ساختِ حساب نگه داشته می‌شود تا گامِ اسم بداند کجا برود
  const newUser = useRef<User | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'name') nameRef.current?.focus();
  }, [step]);

  const phoneValid = /^09\d{9}$/.test(phone);

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
      const { user, isNew } = await authApi.verifyOtp({ phone, code: value });
      setUser(user);
      // حسابِ قدیمی مستقیم وارد می‌شود؛ حسابِ تازه یک گام دیگر دارد
      if (isNew) {
        newUser.current = user;
        setStep('name');
      } else {
        navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
      }
    } catch (err) {
      setCode('');
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده.'));
    } finally {
      setBusy(false);
    }
  };

  const finishSignup = async () => {
    const name = firstName.trim();
    if (!name || busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await authApi.updateMe({ firstName: name });
      setUser(user);
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'ذخیره نشد؛ یک‌بار دیگر امتحان کن.'));
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'phone') void sendOtp();
    else if (step === 'code') void verify();
    else void finishSignup();
  };

  const changeNumber = () => {
    setStep('phone');
    setCode('');
    setDevCode(undefined);
    setError('');
  };

  const activeIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* نوارِ گام‌ها — بچه ببیند کجای کار است */}
      <ol className={styles.steps} aria-label="مرحله‌های ورود">
        {STEPS.map((s, i) => (
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
          <p className={styles.subtitle}>شماره‌ت رو بزن تا یه کد برات بفرستم</p>

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
              onChange={(e) => setPhone(digits(e.target.value).slice(0, 11))}
              aria-label="شماره موبایل"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={!phoneValid || busy}>
            {busy ? 'در حال ارسال…' : 'ارسال کد'}
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
          <p className={styles.subtitle}>حسابت ساخته شد! فقط بگو چی صدات کنیم</p>

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
            {busy ? 'یه لحظه…' : 'بریم تو شهر!'}
          </button>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
