import { PLANTS } from '../../gardenData';
import type { GrowthStage, PlantKind } from '../../types';

interface Props {
  kind: PlantKind;
  stage: GrowthStage;
}

const LEAF = '#6ba644';
const LEAF_DARK = '#4c8531';
const STEM = '#4f8a35';

/** ارتفاع ساقه به ازای هر مرحله (viewBox 60×90، زمین حدود y=80) */
const STEM_TOP = [74, 60, 46, 36, 28, 22];

function Bloom({ kind, stage }: { kind: PlantKind; stage: GrowthStage }) {
  const { bloom, bloomDark } = PLANTS[kind];
  const y = STEM_TOP[stage];

  // مرحله‌ی ۳: غنچه‌ی بسته برای همه‌ی گیاه‌ها
  if (stage === 3) {
    return <path d={`M30 ${y + 4}c-4 0-6-3-6-6s3-6 6-9c3 3 6 6 6 9s-2 6-6 6z`} fill={bloomDark} />;
  }
  if (stage < 3) return null;

  const big = stage === 5;
  const s = big ? 1.15 : 1;

  switch (kind) {
    case 'sunflower': {
      const petals = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = 11 * s;
        return (
          <ellipse
            key={i}
            cx={30 + Math.cos(a) * r}
            cy={y + Math.sin(a) * r}
            rx={5 * s}
            ry={2.6 * s}
            fill={bloom}
            transform={`rotate(${(a * 180) / Math.PI} ${30 + Math.cos(a) * r} ${y + Math.sin(a) * r})`}
          />
        );
      });
      return (
        <g>
          {petals}
          <circle cx={30} cy={y} r={7 * s} fill={bloomDark} />
        </g>
      );
    }
    case 'tulip':
      return (
        <path
          d={`M30 ${y + 10}c-7 0-9-6-9-11 3 2 5 2 6-1 1 3 5 3 6 0 1 3 3 3 6 1 0 5-2 11-9 11z`}
          fill={bloom}
        />
      );
    case 'tomato':
      return (
        <g>
          <circle cx={25} cy={y + 3} r={5 * s} fill={bloom} />
          <circle cx={35} cy={y + 6} r={5 * s} fill={bloomDark} />
          {big && <circle cx={31} cy={y - 3} r={5} fill={bloom} />}
          <path d={`M25 ${y - 2}l0 -3M35 ${y + 1}l0 -3`} stroke={STEM} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    case 'sapling':
      return (
        <g>
          <circle cx={24} cy={y + 2} r={9 * s} fill={LEAF} />
          <circle cx={36} cy={y + 2} r={9 * s} fill={LEAF_DARK} />
          <circle cx={30} cy={y - 6} r={10 * s} fill={bloom} />
        </g>
      );
    case 'clover':
      return (
        <g>
          <circle cx={23} cy={y + 2} r={6 * s} fill={bloom} />
          <circle cx={37} cy={y + 2} r={6 * s} fill={bloom} />
          <circle cx={30} cy={y - 5} r={6 * s} fill={bloomDark} />
          <circle cx={30} cy={y} r={2} fill={LEAF_DARK} />
        </g>
      );
  }
}

/** یک گیاه به‌صورت SVG پارامتریک — از دانه تا شکوفه‌ی کامل، بر اساس نوع و مرحله */
export function PlantSprite({ kind, stage }: Props) {
  const top = STEM_TOP[stage];

  return (
    <svg viewBox="0 0 60 90" width="100%" height="100%" role="img" aria-label={PLANTS[kind].name}>
      {/* پشته‌ی خاک */}
      <ellipse cx={30} cy={82} rx={16} ry={5} fill="#6b4a2f" />
      <ellipse cx={30} cy={80} rx={13} ry={3.5} fill="#82603f" />

      {stage === 0 ? (
        // دانه/جوانه‌ی کوچک
        <g>
          <path d="M30 80c0-3 .2-5 0-7" stroke={STEM} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <path d="M30 74c-3 0-5-2-5-4 3 0 5 2 5 4z" fill={LEAF} />
        </g>
      ) : (
        <g>
          {/* ساقه */}
          <path d={`M30 80 Q31 ${(80 + top) / 2} 30 ${top}`} stroke={STEM} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          {/* برگ‌ها */}
          <path d={`M30 68c-6 1-9-2-10-6 5-1 9 1 10 6z`} fill={LEAF} />
          {stage >= 2 && <path d={`M30 60c6 1 9-2 10-6-5-1-9 1-10 6z`} fill={LEAF_DARK} />}
          {stage >= 4 && <path d={`M30 52c-6 1-9-2-10-6 5-1 9 1 10 6z`} fill={LEAF} />}
          <Bloom kind={kind} stage={stage} />
        </g>
      )}
    </svg>
  );
}
