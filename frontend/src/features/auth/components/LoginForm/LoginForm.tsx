import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ROLE_HOME } from '@/types/user';
import { useAuth } from '../../context';
import { authApi } from '../../api';
import { enableGuestMode } from '../../guest';
import styles from './LoginForm.module.css';

export function LoginForm() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await authApi.login({ phone, password });
      setUser(user);
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true });
    } catch {
      setError('ورود ناموفق بود؛ شماره یا رمز را بررسی کن.');
    } finally {
      setSubmitting(false);
    }
  };

  const enterAsGuest = () => {
    setUser(enableGuestMode());
    navigate('/', { replace: true });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h1 className={styles.title}>لوکو</h1>
      <p className={styles.subtitle}>شهر یادگیری و بازی!</p>

      <input
        className={styles.input}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="شماره موبایل"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="password"
        autoComplete="current-password"
        placeholder="رمز عبور"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? 'در حال ورود…' : 'ورود'}
      </button>

      <button type="button" className={styles.guest} onClick={enterAsGuest}>
        ورود به عنوان مهمان
      </button>

      <p className={styles.footer}>
        حساب نداری؟ <Link to="/register">ثبت‌نام والدین</Link>
      </p>
    </form>
  );
}
