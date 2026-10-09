import type { ReactNode } from 'react';
import { EmptyState } from '../States/States';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  /** روی گوشی پنهان شود */
  optional?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  caption?: string;
}

/** جدولِ فهرست‌ها؛ روی گوشی هر ردیف یک کارت می‌شود */
export function DataTable<T>({ columns, rows, rowKey, loading, onRowClick, empty, caption }: Props<T>) {
  if (loading && !rows) {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-label="در حالِ بارگذاری">
        {Array.from({ length: 6 }, (_, i) => <span key={i} />)}
      </div>
    );
  }
  if (!rows || rows.length === 0) return <EmptyState>{empty ?? 'چیزی پیدا نشد.'}</EmptyState>;
  return (
    <div className={styles.wrap} data-loading={loading || undefined}>
      <table className={styles.table}>
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined} data-optional={c.optional || undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              data-clickable={onRowClick ? 'true' : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} data-optional={c.optional || undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
