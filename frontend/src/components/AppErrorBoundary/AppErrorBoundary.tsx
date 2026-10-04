import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineArrowPath, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { audienceForPath } from '@/lib/api';
import { claimReload, isChunkError } from './chunkReload';
import styles from './AppErrorBoundary.module.css';

function Fallback({ chunk }: { chunk: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const home = audienceForPath(pathname) === 'parent' ? '/parent-panel' : '/';
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className={styles.screen} role="alert">
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden>
          <HiOutlineExclamationTriangle />
        </span>
        <h1 className={styles.title}>این صفحه باز نشد</h1>
        <p className={styles.text}>
          {offline
            ? 'به نظر اینترنت وصل نیست. اتصال را بررسی کنید و دوباره تلاش کنید.'
            : chunk
              ? 'نسخه‌ی تازه‌ای از لوکو آمده است؛ یک بار دوباره بارگذاری کنید.'
              : 'مشکلی پیش آمد. دوباره تلاش کنید؛ اطلاعاتتان سرِ جایش است.'}
        </p>
        <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
          <HiOutlineArrowPath aria-hidden />
          تلاشِ دوباره
        </button>
        {pathname !== home && (
          <button type="button" className={styles.ghost} onClick={() => navigate(home, { replace: true })}>
            بازگشت به صفحه‌ی اصلی
          </button>
        )}
      </div>
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** با عوضِ شدنِ مسیر، خطای قبلی پاک می‌شود */
  resetKey: string;
}

interface BoundaryState {
  error: Error | null;
  /** مسیری که این وضعیت مالِ آن است */
  key: string;
}

/**
 * بدونِ این، هر خطای رندر یا چانکی که نیاید کلِ اپ را برمی‌چیند و صفحه سفید
 * می‌ماند. چانکِ نیامده (پس از انتشار) یک بار خودکار بارگذاری می‌شود؛ بقیه
 * صفحه‌ی «باز نشد» با دکمه‌ی تلاشِ دوباره می‌بینند.
 */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { error: null, key: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkError(error) && navigator.onLine && claimReload(sessionStorage)) {
      window.location.reload();
      return;
    }
    console.error('[luko] صفحه از کار افتاد', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <Fallback chunk={isChunkError(error)} />;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
