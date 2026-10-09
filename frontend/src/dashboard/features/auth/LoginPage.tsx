import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { HiOutlineDevicePhoneMobile, HiOutlineLockClosed, HiOutlineShieldCheck } from 'react-icons/hi2';
import { Button } from '../../components/Button/Button';
import { TextField } from '../../components/Fields/Fields';
import { ensureCsrf, messageOf } from '../../lib/api';
import { faNum, latinDigits } from '../../lib/format';
import { authApi, needsCode } from './authApi';
import { useSession } from './useSession';
import styles from './LoginPage.module.css';

interface Challenge {
  id: string;
  phone: string;
  devCode?: string;
}

/** ورود: شماره و رمز، و اگر روی سرور روشن باشد کدِ پیامکی */
export function LoginPage() {
  const { signedIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void ensureCsrf().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await ensureCsrf();
      await job();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const start = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await authApi.login(latinDigits(phone), password);
      setPassword('');
      if (!needsCode(res)) {
        signedIn(res);
        return;
      }
      setChallenge({ id: res.challenge, phone: res.phone, devCode: res.devCode });
      setWait(res.resendIn);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    void run(async () => signedIn(await authApi.verify(challenge.id, latinDigits(code))));
  };

  const resend = () => {
    if (!challenge) return;
    void run(async () => {
      const res = await authApi.resend(challenge.id);
      setChallenge({ ...challenge, devCode: res.devCode });
      setWait(res.resendIn);
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.logo} aria-hidden>
          <HiOutlineShieldCheck />
        </span>
        <h1 className={styles.title}>داشبوردِ مدیریتِ لوکو</h1>
        {!challenge ? (
          <form className={styles.form} onSubmit={start}>
            <p className={styles.lead}>فقط برای تیمِ لوکو. با شماره و رمزِ حسابِ تیم وارد شوید.</p>
            <TextField label="شماره‌ی موبایل" value={phone} onChange={(e) => setPhone(e.target.value)}
              inputMode="tel" autoComplete="username" placeholder="۰۹۱۲۱۲۳۴۵۶۷" dir="ltr" required />
            <TextField label="رمز" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} icon={<HiOutlineLockClosed aria-hidden />}>
              ادامه
            </Button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={verify}>
            <p className={styles.lead}>
              <HiOutlineDevicePhoneMobile aria-hidden /> کدِ ۶ رقمی به <b dir="ltr">{challenge.phone}</b> پیامک شد.
            </p>
            <TextField label="کدِ تأیید" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
              autoComplete="one-time-code" maxLength={6} dir="ltr" className={styles.code} autoFocus required />
            {challenge.devCode && <p className={styles.dev}>حالتِ توسعه — کد: {challenge.devCode}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <Button type="submit" variant="primary" loading={busy}>ورود</Button>
            <div className={styles.row}>
              <button type="button" className={styles.link} disabled={wait > 0 || busy} onClick={resend}>
                {wait > 0 ? `کدِ تازه تا ${faNum(wait)} ثانیه‌ی دیگر` : 'کدِ تازه بفرست'}
              </button>
              <button type="button" className={styles.link} onClick={() => { setChallenge(null); setCode(''); setError(''); }}>
                شماره‌ی دیگر
              </button>
            </div>
          </form>
        )}
      </section>
      <p className={styles.foot}>همه‌ی ورودها و کارها ثبت می‌شوند.</p>
    </main>
  );
}
