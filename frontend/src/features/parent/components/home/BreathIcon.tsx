import type { SVGProps } from 'react';

/** تنفس: سه موجِ هوا — هم‌سبکِ Heroicons (خطی، ۱.۵) چون hi2 آیکونِ تنفس ندارد */
export function BreathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" width="1em" height="1em" {...props}>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h15a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </svg>
  );
}
