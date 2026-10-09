export interface Series {
  key: string;
  label: string;
  /** متغیرِ رنگ از dashboard.css، مثلاً var(--chart-1) */
  color: string;
}

export interface Point {
  label: string;
  values: Record<string, number>;
}

export interface ChartProps {
  points: Point[];
  series: Series[];
  height?: number;
  /** نمایشِ عدد در محور و برچسب */
  format?: (value: number) => string;
  /** عنوانِ جدولِ داده‌ها و توضیحِ صفحه‌خوان */
  title: string;
}
