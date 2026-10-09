import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from 'react-icons/hi2';
import { latinDigits, looksLikeJalali } from '../../lib/format';
import styles from './Filters.module.css';

export interface Option {
  value: string;
  label: string;
}

/** نوارِ فیلترها؛ روی گوشی می‌پیچد */
export function FilterBar({ children, onReset, active }: { children: ReactNode; onReset?: () => void; active?: number }) {
  return (
    <div className={styles.bar} role="search">
      {children}
      {onReset && Boolean(active) && (
        <button type="button" className={styles.reset} onClick={onReset}>
          <HiOutlineXMark aria-hidden />
          پاک‌کردنِ فیلترها
        </button>
      )}
    </div>
  );
}

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** جستجو با ۳۵۰ میلی‌ثانیه درنگ تا با هر حرف درخواست نرود */
export function SearchBox({ value, onChange, placeholder = 'جستجو…' }: SearchProps) {
  const [text, setText] = useState(value);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return undefined;
    const timer = window.setTimeout(() => changeRef.current(text.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [text, value]);
  return (
    <label className={styles.search}>
      <HiOutlineMagnifyingGlass aria-hidden />
      <span className="visually-hidden">{placeholder}</span>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  allLabel?: string;
}

export function SelectFilter({ label, value, options, onChange, allLabel = 'همه' }: SelectProps) {
  return (
    <label className={styles.select}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

interface ChipsProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

/** چندانتخابی؛ مقدار «a,b» در نشانی */
export function ChipFilter({ label, value, options, onChange }: ChipsProps) {
  const chosen = new Set(value ? value.split(',') : []);
  const toggle = (v: string) => {
    const next = new Set(chosen);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(options.map((o) => o.value).filter((o) => next.has(o)).join(','));
  };
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      <span className={styles.chipsLabel}>{label}</span>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={chosen.has(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface DateProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** تاریخِ شمسی مثلِ ۱۴۰۵/۷/۱۷؛ تا شکلش درست نباشد فرستاده نمی‌شود */
export function DateFilter({ label, value, onChange }: DateProps) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const bad = text.trim() !== '' && !looksLikeJalali(text);
  return (
    <label className={styles.select} data-invalid={bad || undefined}>
      <span>{label}</span>
      <input
        value={text}
        inputMode="numeric"
        placeholder="۱۴۰۵/۰۷/۰۱"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!text.trim()) onChange('');
          else if (looksLikeJalali(text)) onChange(latinDigits(text.trim()));
        }}
        aria-invalid={bad || undefined}
      />
    </label>
  );
}
