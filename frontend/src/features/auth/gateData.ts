import { LUKORIANS, type Lukorian } from '@/lib/characters';

/**
 * گفت‌وگوی دمِ دروازه‌ی شهر: پری (نقشه) و داداشش پویا (قطب‌نما).
 * هرکدام یک جمله؛ یک دور گفته می‌شود و روی جمله‌ی پویا — دعوت به زدنِ
 * شماره — می‌ماند. زدنِ حباب جمله‌ی بعدی را می‌آورد.
 */
export interface GateLine {
  speaker: Lukorian;
  text: string;
}

export const GATE_LINES: GateLine[] = [
  { speaker: LUKORIANS.welcome, text: 'سلام! من پری‌ام، اینم داداشم پویا. دمِ دروازه‌ی شهر منتظرت بودیم!' },
  { speaker: LUKORIANS.navigator, text: 'پری نقشه داره، من قطب‌نما. شماره‌ت رو بزن تا با هم بریم تو شهرِ لوکو!' },
];

/** هر جمله چقدر روی حباب می‌ماند */
export const LINE_MS = 4800;
