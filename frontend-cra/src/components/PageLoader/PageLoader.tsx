import styles from './PageLoader.module.css';

export function PageLoader() {
  return (
    <div className={styles.wrapper} role="status" aria-label="در حال بارگذاری">
      <div className={styles.spinner} />
    </div>
  );
}
