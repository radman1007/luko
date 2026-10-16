import logo from '@/assets/brand/luko-logo.webp';

interface Props {
  /** بلندی به پیکسل؛ پهنا از نسبتِ خودِ نشان (حدودِ ۲ به ۱) می‌آید */
  height?: number;
  className?: string;
}

/**
 * لوگوی لوکو — همان نشانِ نارنجی‌آبیِ «لوکو» (favicon و ویدیوی آشنایی). جای نشانِ موقتِ BrandMark در پنلِ والدین.
 * تزئینی است؛ نامِ «لوکو» یا عنوانِ صفحه کنارش برای صفحه‌خوان می‌آید.
 */
export function LukoLogo({ height = 24, className }: Props) {
  return (
    <img src={logo} alt="" aria-hidden className={className} draggable={false}
      style={{ height, width: 'auto', display: 'block' }} />
  );
}
