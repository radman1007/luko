import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineChartBar,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
  HiOutlineUser,
} from 'react-icons/hi2';
import { LukoLogo } from '@/components/ui/LukoLogo/LukoLogo';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { authApi } from '@/features/auth/api';
import type { VerifyOtpResult } from '@/features/auth/api';
import { useAuth } from '@/features/auth/context';
import { enableParentGuestMode, GUEST_PARENT_USER } from '@/features/auth/guest';
import { blockContextMenu } from '@/features/parent/noCopy';
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

/** سه نویدِ پایینِ ستونِ معرفی */
const PROMISES = [
  { icon: HiOutlineShieldCheck, title: 'حریمِ خصوصیِ تضمین‌شده', text: 'نوشته‌های خصوصیِ فرزندتان رمزنگاری شده‌اند و دیده نمی‌شوند.' },
  { icon: HiOutlineChartBar, title: 'گزارشِ رشدِ دقیق', text: 'پیشرفتِ آموزشیِ فرزندتان را هفته‌به‌هفته از بازی‌های واقعی‌اش ببینید.' },
  { icon: HiOutlineHeart, title: 'همراهیِ بی‌وقفه', text: 'در مسیرِ یادگیری، همیشه کنارِ فرزندتان باشید.' },
];

/** نمونه‌ی ثابتِ کارتِ پنل در ستونِ معرفی (تزئینی؛ داده‌ی هیچ‌کس نیست) */
const SAMPLE_WEEK = [38, 52, 30, 64, 44, 88, 40];
const SAMPLE_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const PHONE_HINT = 'شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

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
  /** همان چیزی که والد تایپ کرده (بعد از +98)؛ شماره‌ی ۰۹… از آن ساخته می‌شود */
  const [phoneInput, setPhoneInput] = useState('');
  const phone = normalizePhone(phoneInput);
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
  const [codeFocused, setCodeFocused] = useState(false);
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

  const verify = async (value = code) => {
    if (busy) return;
    if (value.length < codeLength) {
      setError('کد را کامل وارد کنید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await authApi.verifyOtp({ phone, code: value, role: 'parent' });
      // والد انتخابگر ندارد (یک شماره = یک والد)؛ این شاخه فقط برای کاملیِ نوع است
      if (result.chooseFrom) {
        setError('یک لحظه مشکل پیش آمد؛ دوباره تلاش کنید.');
        return;
      }
      afterSignIn(result, resetting);
    } catch (err) {
      setCode('');
      setError(errorMessage(err, 'کد اشتباه یا منقضی شده است.'));
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  /** خانه‌ی آخر که پر شد، خودش تأیید می‌کند (چسباندن و پرکردنِ خودکارِ پیامک هم همین‌طور) */
  const typeCode = (raw: string) => {
    const next = digits(raw).slice(0, codeLength);
    setCode(next);
    if (error) setError('');
    if (next.length === codeLength && next !== code) void verify(next);
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

  const heading =
    step === 'phone' ? 'ورود به پنل والدین'
      : step === 'code' ? 'کد تأیید را وارد کنید'
        : step === 'password' ? 'ورود با رمز عبور'
          : step === 'newPassword' ? (resetting ? 'رمز تازه بسازید' : 'یک رمز برای حسابتان')
            : 'آخرین قدم';

  const subtitle =
    step === 'phone'
      ? 'شماره موبایل‌تان را وارد کنید تا کد تأیید برایتان ارسال شود.'
      : step === 'code'
        ? `کدِ ${codeLength.toLocaleString('fa-IR')} رقمی به ${phone.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])} پیامک شد.`
        : step === 'password'
          ? 'وقتی پیامک نمی‌رسد، با رمزی که برای حسابتان گذاشته‌اید وارد شوید.'
          : step === 'newPassword'
            ? 'ورود همیشه با کدِ پیامکی است؛ این رمز برای وقتی است که پیامک نرسد.'
            : 'نامتان را بنویسید تا پنل به اسمِ خودتان باشد.';

  const phoneField = (
    <label className={styles.field}>
      شماره موبایل
      <span className={styles.phoneGroup} dir="ltr">
        <span className={styles.prefix} aria-hidden>+98</span>
        <input
          inputMode="numeric"
          autoComplete="tel"
          placeholder="۹۱۲ ۳۴۵ ۶۷۸۹"
          maxLength={16}
          value={phoneInput}
          onChange={(e) => { setPhoneInput(e.target.value); if (error) setError(''); }}
          aria-invalid={Boolean(error) && !phoneValid}
          aria-label="شماره موبایل (بی‌پیش‌شماره یا با صفر)"
        />
      </span>
    </label>
  );

  return (
    <main className={styles.page} onContextMenu={blockContextMenu}>
      <section className={styles.formSide}>
        <header className={styles.brand}>
          <LukoLogo height={34} />
          <span className={styles.srOnly}>لوکو</span>
        </header>

        <div className={styles.formBox}>
          {step !== 'phone' && (
            <button type="button" className={styles.back} onClick={backToPhone}>
              <HiOutlineArrowRight aria-hidden /> تغییر شماره
            </button>
          )}
          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.subtitle}>{subtitle}</p>

          {step === 'phone' ? (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
              {phoneField}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={busy || !phoneValid}>
                {busy ? 'یک لحظه…' : 'دریافت کد تأیید'}
                <HiOutlineArrowLeft aria-hidden />
              </button>
            </form>
          ) : step === 'code' ? (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void verify(); }}>
              <label className={styles.field}>
                کد تأیید
                {/* هر رقم یک خانه؛ ورودیِ واقعی یکی است و رویِ خانه‌ها پهن شده تا چسباندن و پرکردنِ خودکارِ
                    پیامک (one-time-code) کار کند */}
                <span className={styles.otp} dir="ltr" data-error={error ? true : undefined}>
                  {Array.from({ length: codeLength }, (_, index) => (
                    <span key={index} className={styles.otpCell} data-filled={index < code.length || undefined}
                      data-active={(codeFocused && (index === code.length
                        || (code.length === codeLength && index === codeLength - 1))) || undefined}>
                      {code[index] ? FA_DIGITS[Number(code[index])] : ''}
                    </span>
                  ))}
                  <input
                    ref={codeRef}
                    className={styles.otpInput}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={codeLength + 6}
                    value={code}
                    onChange={(e) => typeCode(e.target.value)}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    aria-label={`کد تأیید ${codeLength.toLocaleString('fa-IR')} رقمی`}
                    aria-invalid={Boolean(error)}
                  />
                </span>
              </label>
              {devCode && <p className={styles.devCode}>کد توسعه: {devCode}</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={busy || code.length < codeLength}>
                {busy ? 'در حال بررسی…' : 'تأیید و ورود'}
                <HiOutlineArrowLeft aria-hidden />
              </button>
              <div className={styles.actions}>
                <button type="button" className={styles.link} disabled={resendIn > 0 || busy}
                  onClick={() => void sendCode(resetting)}>
                  {resendIn > 0 ? `ارسال دوباره تا ${resendIn.toLocaleString('fa-IR')} ثانیه` : 'ارسال دوباره‌ی کد'}
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
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void loginWithPassword(); }}>
              <label className={styles.field}>
                رمز عبور
                <span className={styles.inputWrap}>
                  <HiOutlineLockClosed aria-hidden />
                  <input ref={passwordRef} type="password" autoComplete="current-password" placeholder="رمز حسابتان"
                    value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }} />
                </span>
              </label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={busy || !password}>
                {busy ? 'در حال ورود…' : 'ورود به پنل'}
                <HiOutlineArrowLeft aria-hidden />
              </button>
              <div className={styles.actions}>
                <button type="button" className={styles.link} disabled={busy} onClick={() => void sendCode()}>
                  ورود با کد پیامکی
                </button>
                <button type="button" className={styles.link} disabled={busy} onClick={() => void sendCode(true)}>
                  رمز را فراموش کرده‌اید؟
                </button>
              </div>
            </form>
          ) : step === 'newPassword' ? (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void saveNewPassword(); }}>
              <label className={styles.field}>
                رمز عبور <small>(دست‌کم ۶ نویسه)</small>
                <span className={styles.inputWrap}>
                  <HiOutlineLockClosed aria-hidden />
                  <input ref={passwordRef} type="password" autoComplete="new-password" placeholder="رمزی که یادتان می‌ماند"
                    value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }} />
                </span>
              </label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={busy || password.length < 6}>
                {busy ? 'در حال ذخیره…' : needsProfile ? 'ذخیره و ادامه' : 'ذخیره و ورود به پنل'}
                <HiOutlineArrowLeft aria-hidden />
              </button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}>
              <label className={styles.field}>
                نام شما
                <span className={styles.inputWrap}>
                  <HiOutlineUser aria-hidden />
                  <input ref={nameRef} autoComplete="name" placeholder="مثلاً رادمان" value={firstName} maxLength={60}
                    onChange={(e) => { setFirstName(e.target.value); if (error) setError(''); }} />
                </span>
              </label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={busy || !firstName.trim()}>
                {busy ? 'در حال ذخیره…' : 'ذخیره و ورود به پنل'}
                <HiOutlineArrowLeft aria-hidden />
              </button>
            </form>
          )}

          <p className={styles.secure}>
            <HiOutlineShieldCheck aria-hidden />
            ورود شما با رمزنگاری و استانداردهای امنیتی محافظت می‌شود.
          </p>

          {step === 'phone' && (
            <div className={styles.more}>
              <button type="button" className={styles.link} onClick={switchToPassword} disabled={busy}>
                ورود با رمز عبور
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  enableParentGuestMode();
                  setUser(GUEST_PARENT_USER);
                  navigate('/parent-panel', { replace: true });
                }}
              >
                دیدنِ پنلِ نمونه (مهمان)
              </button>
            </div>
          )}
        </div>

        <footer className={styles.foot}>
          <p>با ورود، <b>شرایطِ استفاده</b> و <b>حریمِ خصوصیِ</b> لوکو را می‌پذیرید.</p>
          <p>دانش‌آموزید؟ <a href="/login">از این‌جا وارد شوید</a></p>
        </footer>
      </section>

      <aside className={styles.showcase} aria-hidden>
        <div className={styles.showHead}>
          <span className={styles.showBrand}><LukoLogo height={24} /></span>
          <span className={styles.chip}>پنل والدین</span>
        </div>

        <div className={styles.showBody}>
          <h2>دنیای کودکتان را<br /><em>از نزدیک</em> دنبال کنید</h2>
          <p>
            گزارش‌های لحظه‌ای یادگیری، پیشنهادهای هوشمندِ روزانه و دستیاری برای هر پرسش — در یک تجربه‌ی ساده و امن.
          </p>

          <div className={styles.preview}>
            <div className={styles.previewHead}>
              <span className={styles.avatar}>آ</span>
              <div>
                <b>آرین</b>
                <small>کلاس دوم · ۸ ساله</small>
              </div>
              <span className={styles.chip}>این هفته</span>
            </div>
            <div className={styles.stats}>
              <div><b>۱٬۲۸۰</b><small>امتیازِ این هفته</small></div>
              <div><b>۱۲</b><small>روزهای پیوسته</small></div>
              <div><b>۳۴۵</b><small>دقیقه مطالعه</small></div>
            </div>
            <div className={styles.bars}>
              {SAMPLE_WEEK.map((value, index) => (
                <span key={SAMPLE_DAYS[index]} data-top={index === 5 || undefined}>
                  <i style={{ height: `${value}%` }} />
                  <small>{SAMPLE_DAYS[index]}</small>
                </span>
              ))}
            </div>
          </div>

          <ul className={styles.promises}>
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span><Icon /></span>
                <div><b>{title}</b><small>{text}</small></div>
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.copy}>© لوکو — همراهِ یادگیریِ کودکان</p>
      </aside>
    </main>
  );
}
