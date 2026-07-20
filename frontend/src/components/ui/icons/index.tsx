/**
 * آیکون‌های اختصاصی لوکو — استایل یکدست با Heroicons Outline (hi2):
 * stroke-محور، strokeWidth 1.8، گوشه‌ها و سرِ خط‌ها گرد، رنگ از currentColor.
 * برای آیکون‌های عمومی مستقیم از react-icons/hi2 استفاده کنید؛
 * اینجا فقط آیکون‌هایی است که معادل Heroicons ندارند.
 */
import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const base = (size: number, props: IconProps) =>
  ({
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  }) as const;

/** سکه‌ی لوکو */
export function CoinIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 9.8v4.4M10.4 11h3.2" />
    </svg>
  );
}

export type MoodVariant = 'happy' | 'calm' | 'tired' | 'sad' | 'angry';

const MOOD_FACES: Record<MoodVariant, React.ReactNode> = {
  happy: (
    <>
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <path d="M8.5 13.5c1 1.6 2.4 2.4 3.5 2.4s2.5-.8 3.5-2.4" />
    </>
  ),
  calm: (
    <>
      <path d="M8 10.2c.7.7 1.6.7 2.3 0M13.7 10.2c.7.7 1.6.7 2.3 0" />
      <path d="M9.5 14.5c.8.8 1.7 1.2 2.5 1.2s1.7-.4 2.5-1.2" />
    </>
  ),
  tired: (
    <>
      <path d="M7.8 9.6h2.7M13.5 9.6h2.7" />
      <path d="M9.8 15h4.4" />
    </>
  ),
  sad: (
    <>
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <path d="M8.5 15.8c1-1.6 2.4-2.4 3.5-2.4s2.5.8 3.5 2.4" />
    </>
  ),
  angry: (
    <>
      <path d="M7.5 8.4l3 1.2M16.5 8.4l-3 1.2" />
      <circle cx="9.3" cy="11" r="0.6" fill="currentColor" />
      <circle cx="14.7" cy="11" r="0.6" fill="currentColor" />
      <path d="M9 15.8c1-1.2 2-1.7 3-1.7s2 .5 3 1.7" />
    </>
  ),
};

/** چهره‌ی حالت‌های احساسی — برای ثبت حال */
export function MoodFaceIcon({ variant, size = 24, ...props }: IconProps & { variant: MoodVariant }) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      {MOOD_FACES[variant]}
    </svg>
  );
}

/** گیاه باغچه در ۴ مرحله‌ی رشد */
export function PlantIcon({ stage, size = 24, ...props }: IconProps & { stage: 0 | 1 | 2 | 3 }) {
  return (
    <svg {...base(size, props)}>
      {/* گلدان */}
      <path d="M7.5 16h9l-1 5.2h-7z" />
      {stage >= 1 && <path d="M12 16v-3.5" />}
      {stage >= 2 && (
        <path d="M12 12.5v-2.7M12 12.2c0-1.8-1.4-3.2-3.2-3.2 0 1.8 1.4 3.2 3.2 3.2z" />
      )}
      {stage >= 3 && (
        <>
          <path d="M12 9.5c0-1.8 1.4-3.2 3.2-3.2 0 1.8-1.4 3.2-3.2 3.2z" />
          <circle cx="12" cy="5.4" r="1.6" />
        </>
      )}
      {stage === 0 && <path d="M10.8 14.2c.4-.5.8-.7 1.2-.7s.8.2 1.2.7" />}
    </svg>
  );
}

/** گنج گمشده‌ی شهر لوکو — ارز ویژه‌ی کارگاه لوکوریان‌سازی */
export function TreasureIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M7 4.5h10l4 5.5-9 9.5L3 10z" />
      <path d="M3 10h18M9.5 4.5L8 10l4 9.5M14.5 4.5L16 10l-4 9.5" />
    </svg>
  );
}

/** نشان برند لوکو — صورت با شاخک، برای جاهایی که لوگوی تصویری نداریم */
export function BrandMark({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="5" y="8" width="14" height="12" rx="5" />
      <path d="M9 8V5.6M15 8V5.6" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="9.6" cy="12.6" r="0.6" fill="currentColor" />
      <circle cx="14.4" cy="12.6" r="0.6" fill="currentColor" />
      <path d="M10 15.6c.6.6 1.3.9 2 .9s1.4-.3 2-.9" />
    </svg>
  );
}
