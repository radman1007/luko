import { useState } from 'react';
import {
  HiOutlineDevicePhoneMobile,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineKey,
} from 'react-icons/hi2';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import type { Child } from '../../types';
import { parentApi } from '../../api';
import { useChildPassword, useSetChildPassword } from '../../useParent';
import styles from './ChildAccountCard.module.css';

interface Props {
  child: Child;
  onDone: (message: string) => void;
}

/** ۳ → «۳» */
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

function message(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

/**
 * حسابِ یک فرزند: رمزش و شماره‌اش.
 *
 * چرا رمز این‌جا دیده می‌شود: پنلِ دانش‌آموز عمداً «فراموشیِ رمز» ندارد —
 * رمزِ تازه ساختن کارِ بچه‌ی کلاس‌اولی نیست. پس تنها راهِ بازیابی همین
 * است که والد ببیندش. رمز رمزنگاری‌شده نگه داشته می‌شود و فقط از همین
 * مسیرِ احرازشده برمی‌گردد.
 *
 * تغییرِ شماره دو سر تأیید می‌خواهد: کدِ شماره‌ی فعلی ثابت می‌کند شماره
 * دستِ خانواده است، و کدِ شماره‌ی تازه جلوی تایپِ اشتباه را می‌گیرد —
 * وگرنه حسابِ بچه روی شماره‌ای می‌رفت که کسی به آن دسترسی ندارد.
 */
export function ChildAccountCard({ child, onDone }: Props) {
  const [open, setOpen] = useState<'none' | 'password' | 'phone'>('none');
  const [shown, setShown] = useState(false);
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState('');

  const [newPhone, setNewPhone] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const password = useChildPassword(open === 'password' ? child.id : null);
  const savePassword = useSetChildPassword(child.id);

  const reset = () => {
    setOpen('none');
    setShown(false);
    setFresh('');
    setNewPhone('');
    setCurrentCode('');
    setNewCode('');
    setSent(false);
    setError('');
  };

  const submitPassword = () => {
    if (fresh.trim().length < 6) {
      setError('رمز باید دست‌کم ۶ نویسه باشد.');
      return;
    }
    setError('');
    savePassword.mutate(fresh.trim(), {
      onSuccess: () => {
        setFresh('');
        onDone(`رمزِ ${child.firstName || 'فرزند'} عوض شد`);
      },
      onError: (err) => setError(message(err, 'رمز ذخیره نشد.')),
    });
  };

  const sendCodes = async () => {
    if (!isValidPhone(newPhone) || busy) return;
    setError('');
    setBusy(true);
    try {
      await parentApi.startChildPhoneChange(child.id, normalizePhone(newPhone));
      setSent(true);
    } catch (err) {
      setError(message(err, 'ارسال کد ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmPhone = async () => {
    if (!currentCode || !newCode || busy) return;
    setError('');
    setBusy(true);
    try {
      await parentApi.confirmChildPhoneChange(child.id, {
        phone: normalizePhone(newPhone),
        currentCode,
        newCode,
      });
      reset();
      onDone('شمارهٔ فرزند عوض شد');
    } catch (err) {
      setError(message(err, 'کدها درست نبودند.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden>
          {(child.firstName || '؟').slice(0, 1)}
        </span>
        <div className={styles.who}>
          <b className={styles.name}>{child.firstName || 'بی‌نام'}</b>
          <span className={styles.phone} dir="ltr">{fa(child.phone ?? '')}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={() => { const next = open === 'password' ? 'none' : 'password'; reset(); setOpen(next); }}
          aria-expanded={open === 'password'}
        >
          <HiOutlineKey aria-hidden />
          رمزِ ورود
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => { const next = open === 'phone' ? 'none' : 'phone'; reset(); setOpen(next); }}
          aria-expanded={open === 'phone'}
        >
          <HiOutlineDevicePhoneMobile aria-hidden />
          تغییرِ شماره
        </button>
      </div>

      {open === 'password' && (
        <div className={styles.panel}>
          <div className={styles.secretRow}>
            <span className={styles.secret} dir="ltr">
              {password.isLoading
                ? '…'
                : !password.data?.hasPassword
                  ? 'هنوز رمزی ندارد'
                  : shown
                    ? password.data.password
                    : '•'.repeat(Math.min(password.data.password.length, 12))}
            </span>
            <button
              type="button"
              className={styles.eye}
              onClick={() => setShown((v) => !v)}
              aria-label={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
              disabled={!password.data?.hasPassword}
            >
              {shown ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
            </button>
          </div>

          <label className={styles.field}>
            رمزِ تازه
            <input
              type="text"
              autoComplete="off"
              placeholder="دست‌کم ۶ نویسه"
              value={fresh}
              onChange={(e) => setFresh(e.target.value)}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.primary}
            onClick={submitPassword}
            disabled={savePassword.isPending}
          >
            {savePassword.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ رمزِ تازه'}
          </button>
        </div>
      )}

      {open === 'phone' && (
        <div className={styles.panel}>
          <p className={styles.note}>
            برای عوض کردنِ شماره، یک کد به شمارهٔ فعلی و یک کد به شمارهٔ تازه
            می‌فرستیم. هر دو باید تأیید شوند.
          </p>

          <label className={styles.field}>
            شمارهٔ تازه
            <input
              dir="ltr"
              inputMode="numeric"
              placeholder="09xxxxxxxxx"
              value={newPhone}
              onChange={(e) => setNewPhone(normalizePhone(e.target.value))}
              disabled={sent}
            />
          </label>

          {!sent ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => void sendCodes()}
              disabled={!isValidPhone(newPhone) || busy}
            >
              {busy ? 'در حال ارسال…' : 'ارسال هر دو کد'}
            </button>
          ) : (
            <>
              <label className={styles.field}>
                کدِ شمارهٔ فعلی ({fa(child.phone ?? '')})
                <input
                  dir="ltr"
                  inputMode="numeric"
                  value={currentCode}
                  onChange={(e) => setCurrentCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <label className={styles.field}>
                کدِ شمارهٔ تازه
                <input
                  dir="ltr"
                  inputMode="numeric"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button
                type="button"
                className={styles.primary}
                onClick={() => void confirmPhone()}
                disabled={!currentCode || !newCode || busy}
              >
                {busy ? 'در حال بررسی…' : 'تأیید و تغییرِ شماره'}
              </button>
            </>
          )}

          {!sent && error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
