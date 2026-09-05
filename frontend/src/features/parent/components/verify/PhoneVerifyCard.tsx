import { useEffect, useRef, useState } from 'react';
import { HiOutlineCheckBadge, HiOutlineShieldCheck } from 'react-icons/hi2';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/context';
import styles from './PhoneVerifyCard.module.css';

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

/** ارقام فارسی/عربی → انگلیسی */
function digits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

/**
 * تأییدِ شماره — اختیاری و هر وقت که والد خواست.
 *
 * ثبت‌نام تأیید نمی‌خواهد، ولی شماره‌ی تأییدشده یعنی اگر رمز را فراموش
 * کرد مطمئن‌تر بازش می‌گرداند. پس اینجا فقط پیشنهاد می‌شود، نه اجبار.
 */
export function PhoneVerifyCard() {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(5);
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

  if (!user || user.isGuest) return null;

  if (user.phoneVerified) {
    return (
      <div className={styles.done}>
        <HiOutlineCheckBadge aria-hidden />
        <div>
          <b>شمارهٔ شما تأیید شده است</b>
          <small dir="ltr">{user.phone}</small>
        </div>
      </div>
    );
  }

  const sendCode = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await authApi.requestOtp(user.phone ?? '');
      setCodeLength(res.codeLength && res.codeLength > 0 ? res.codeLength : 5);
      setDevCode(res.devCode);
      setResendIn(res.resendIn);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'ارسال کد انجام نشد؛ چند لحظه بعد دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < codeLength) return;
    setError('');
    setBusy(true);
    try {
      setUser(await authApi.verifyPhone(code));
      setStep('idle');
    } catch (err) {
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده است.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden>
          <HiOutlineShieldCheck />
        </span>
        <div>
          <b>شمارهٔ موبایلتان را تأیید کنید</b>
          <small>
            اختیاری است، ولی با شمارهٔ تأییدشده اگر رمزتان را فراموش کنید
            راحت‌تر و مطمئن‌تر برمی‌گردید.
          </small>
        </div>
      </div>

      {step === 'idle' ? (
        <button type="button" className={styles.primary} onClick={() => void sendCode()} disabled={busy}>
          {busy ? 'در حال ارسال…' : 'ارسال کد تأیید'}
        </button>
      ) : (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void verify(); }}>
          <input
            ref={codeRef}
            className={styles.codeInput}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={'- '.repeat(codeLength).trim()}
            value={code}
            onChange={(e) => { setCode(digits(e.target.value).slice(0, codeLength)); if (error) setError(''); }}
            aria-label="کد تأیید"
          />
          {devCode && <p className={styles.devCode}>کد توسعه: {devCode}</p>}
          <button type="submit" className={styles.primary} disabled={busy || code.length < codeLength}>
            {busy ? 'در حال بررسی…' : 'تأیید شماره'}
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
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
