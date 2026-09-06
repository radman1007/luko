/**
 * هندسه‌ی نقشه‌ی سیزن.
 *
 * مرحله‌ها روی یک مسیرِ مارپیچ از **پایین به بالا** می‌نشینند: مرحله‌ی ۱ کفِ
 * نقشه است و هرچه بالاتر می‌روی جلوتری. مسیر یک منحنیِ پیوسته‌ی SVG است که
 * از میانِ مرکزِ گره‌ها رد می‌شود، پس ریاضیش اینجاست و کامپوننت فقط رسم می‌کند.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DecorKind, PhotoSpot, SeasonStage, SeasonWeek } from './seasonData';

/** قطرِ گره */
export const NODE_SIZE = 78;
/** فاصله‌ی مرکز تا مرکزِ دو مرحله */
const STEP = 126;
/** ادامه‌ی مسیر بالای آخرین مرحله — همان‌جا که زیرِ ابرها می‌رود */
const TOP_LEAD = 208;
/** وقتی ابری در کار نیست (سیزن تمام شده) مسیر کوتاه تمام می‌شود */
const TOP_LEAD_CLEAR = 76;
/** چند مرحله‌ی محو پشتِ ابرها دیده شود تا معلوم باشد مسیر تمام نشده */
const GHOSTS = 2;
/** جا برای پرچمِ شروع، زیرِ مرحله‌ی اول */
const BOTTOM_LEAD = 104;
/** دامنه‌ی مارپیچ نسبت به عرضِ نقشه */
const AMPLITUDE = 0.3;
/** چند عنصرِ تزئینی به‌ازای هر مرحله پخش شود */
const DECOR_PER_STAGE = 1.4;
/** تزئینات دستِ‌کم این‌قدر از مرکزِ مسیر فاصله بگیرند تا خوانایی نرود */
const DECOR_CLEARANCE = 0.34;
/** ایستگاهِ یادگاری این‌قدر از جاده کنار می‌رود تا روی گره‌ها نیفتد */
const MEMORY_OFFSET = 0.33;
/** ایستگاه کجای فاصله‌ی دو مرحله بنشیند (۰٫۵ = وسط، جایی که نشانِ هفته است) */
const MEMORY_LERP = 0.34;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * یک موجِ سینوسیِ هشت‌قدمی. نمونه‌برداریِ ریزتر از «چپ/راست»ِ ساده، مسیر را
 * نرم و پیوسته نشان می‌دهد به‌جای زیگزاگِ تیز.
 */
const WAVE = [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7];

export interface MapNode {
  stage: SeasonStage;
  /** مرکزِ گره بر حسبِ پیکسل، نسبت به گوشه‌ی نقشه */
  x: number;
  y: number;
  done: boolean;
  /** همان مرحله‌ای که بچه باید همین حالا برود */
  isCurrent: boolean;
  /** نوبتش نرسیده — مرحله‌ی قبلی هنوز تمام نشده */
  locked: boolean;
}

export interface WeekMark {
  week: SeasonWeek;
  /** ارتفاعِ نوارِ ایست‌گاه، بینِ آخرین مرحله‌ی هفته‌ی قبل و اولین مرحله‌ی این هفته */
  y: number;
  /** نشان سمتِ خالیِ مسیر می‌نشیند تا روی نامِ مرحله‌ها نیفتد */
  side: 'left' | 'right';
}

export interface Point {
  x: number;
  y: number;
}

/** یک ایستگاهِ یادگاری روی مسیر، بینِ دو مرحله */
export interface MemoryPoint extends Point {
  spot: PhotoSpot;
  /** سمتی که کارتِ متن باز می‌شود — مسیر آن طرف خالی است */
  side: 'left' | 'right';
  /** هنوز به این نقطه نرسیده؟ */
  locked: boolean;
}

/** عنصرِ تزئینی، با جای ثابت تا هر رندر جابه‌جا نشود */
export interface DecorPoint extends Point {
  kind: DecorKind;
  scale: number;
  /** تأخیرِ انیمیشن، تا همه با هم نتپند */
  delay: number;
}

export interface SeasonMapGeometry {
  nodes: MapNode[];
  memories: MemoryPoint[];
  decor: DecorPoint[];
  weekMarks: WeekMark[];
  /** سایه‌ی مرحله‌های نرسیده، پشتِ ابر */
  ghosts: Point[];
  /** کلِ مسیر — کم‌رنگ، تا انتهای دیدرس */
  trackPath: string;
  /** بخشِ طی‌شده — تا مرحله‌ی جاری، روشن */
  litPath: string;
  height: number;
  /** مرکزِ مرحله‌ی جاری؛ برای اسکرولِ خودکار */
  currentY?: number;
}

/**
 * منحنیِ نرم از میانِ نقطه‌ها (Catmull-Rom → بزیهِ مکعبی).
 * خطِ شکسته‌ی ساده مسیر را ارزان نشان می‌دهد؛ این نسخه پیوسته و روان است.
 */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * شبه‌تصادفیِ قطعی از یک عدد. برای چیدنِ تزئینات لازم است: `Math.random`
 * هر رندر جای همه‌چیز را عوض می‌کرد و صفحه می‌لرزید.
 */
function pseudo(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** عرضِ زنده‌ی یک عنصر — مسیر باید با پهنای واقعیِ گوشی رسم شود */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * چیدمانِ نقشه برای هفته‌های بازشده.
 * `weeks` باید به ترتیبِ صعودی باشد؛ خروجی هم صعودی است و وارونگی را
 * مختصاتِ y انجام می‌دهد، نه ترتیبِ آرایه.
 */
export function useSeasonMap(
  weeks: SeasonWeek[],
  done: Set<string>,
  currentStageId: string | undefined,
  width: number,
  /** هفته‌ی نرسیده‌ای هست؟ اگر نه، نه ابری هست نه سایه‌ای و مسیر همان‌جا تمام می‌شود */
  hasClouds: boolean,
  /** ایستگاه‌های عکسِ یادگاری */
  photoSpots: PhotoSpot[] = [],
  /** چه عناصری اطرافِ مسیر پخش شوند */
  decorKinds: DecorKind[] = [],
): SeasonMapGeometry {
  return useMemo(() => {
    const stages: SeasonStage[] = weeks.flatMap((week) => week.stages);
    const topLead = hasClouds ? TOP_LEAD : TOP_LEAD_CLEAR;
    const height = BOTTOM_LEAD + topLead + NODE_SIZE + Math.max(0, stages.length - 1) * STEP;
    const baseY = height - BOTTOM_LEAD - NODE_SIZE / 2;
    const centerX = width / 2;
    const amp = AMPLITUDE * width;

    const nodes: MapNode[] = stages.map((stage, i) => ({
      stage,
      x: centerX + WAVE[i % WAVE.length] * amp,
      y: baseY - i * STEP,
      done: done.has(stage.id),
      isCurrent: stage.id === currentStageId,
      locked: stage.locked,
    }));

    // نوارِ ایست‌گاه بینِ دو هفته؛ هفته‌ی اول نشان نمی‌خواهد چون شروعِ مسیر است
    const weekMarks: WeekMark[] = [];
    let seen = 0;
    weeks.forEach((week, i) => {
      if (i > 0 && week.stages.length > 0) {
        const first = nodes[seen];
        const last = nodes[seen - 1];
        if (first && last) {
          weekMarks.push({
            week,
            y: (first.y + last.y) / 2,
            side: (first.x + last.x) / 2 > centerX ? 'left' : 'right',
          });
        }
      }
      seen += week.stages.length;
    });

    if (width === 0 || nodes.length === 0) {
      return { nodes, memories: [], decor: [], weekMarks, ghosts: [],
               trackPath: '', litPath: '', height };
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    // دو سرِ مسیر: یکی زیرِ پرچمِ شروع، یکی بالا که زیرِ ابرها گم می‌شود
    const tail = { x: first.x, y: first.y + BOTTOM_LEAD * 0.7 };
    // موج را بالاتر از آخرین مرحله ادامه می‌دهیم؛ همان‌جا سایه‌ها می‌نشینند
    const ghosts: Point[] = hasClouds
      ? Array.from({ length: GHOSTS }, (_, k) => ({
          x: centerX + WAVE[(nodes.length + k) % WAVE.length] * amp,
          y: last.y - (k + 1) * STEP * 0.62,
        }))
      : [];
    const tip = ghosts[ghosts.length - 1] ?? last;
    const head = {
      x: centerX + WAVE[(nodes.length + ghosts.length) % WAVE.length] * amp * 0.7,
      y: tip.y - (hasClouds ? 46 : 44),
    };
    const points = [tail, ...nodes.map((n) => ({ x: n.x, y: n.y })), ...ghosts, head];

    // تا کجا روشن است: تا مرحله‌ی جاری، و اگر همه رفته‌اند تا سرِ مسیر
    const currentIndex = nodes.findIndex((n) => n.isCurrent);
    const litUpto = currentIndex >= 0 ? currentIndex + 1 : nodes.length + 1;

    /**
     * ایستگاهِ یادگاری بینِ دو مرحله می‌نشیند، نه رویشان: باید در نگاهِ
     * اول از گره‌های بازی جدا دیده شود، وگرنه بچه فکر می‌کند بازیِ دیگری است.
     */
    const memories: MemoryPoint[] = photoSpots
      .filter((spot) => spot.afterStage >= 1 && spot.afterStage <= nodes.length)
      .map((spot) => {
        const before = nodes[spot.afterStage - 1];
        const after = nodes[spot.afterStage];
        // نشانِ هفته هم دقیقاً وسطِ دو مرحله می‌نشیند؛ ایستگاه را کمی
        // پایین‌تر می‌گذاریم تا وقتی هر دو یک‌جا می‌افتند روی هم نروند.
        const y = after
          ? before.y + (after.y - before.y) * MEMORY_LERP
          : before.y - STEP * 0.6;
        const mid = after ? (before.x + after.x) / 2 : before.x;
        // نقطه‌ی وسطِ دو مرحله روی خودِ جاده می‌افتد و با گره و نامِ
        // مرحله تداخل می‌کند. ایستگاه را به **سمتِ خالیِ** جاده می‌بریم —
        // آن‌جا که هیچ‌کدام از دو مرحله‌ی همسایه نیست — تا مثل نشانه‌ای
        // کنارِ جاده دیده شود، نه مثل یک مرحله‌ی دیگر.
        const away = mid > centerX ? -1 : 1;
        const x = clamp(
          centerX + away * MEMORY_OFFSET * width,
          NODE_SIZE * 0.65,
          width - NODE_SIZE * 0.65,
        );
        return {
          spot,
          x,
          y,
          side: x > centerX ? 'left' : 'right',
          // تا مرحله‌ی قبلش نرود، ایستگاه هم باز نمی‌شود
          locked: !done.has(before.stage.id),
        } satisfies MemoryPoint;
      });

    /**
     * تزئینات با یک شبه‌تصادفیِ قطعی چیده می‌شوند (نه Math.random) تا با
     * هر رندر جابه‌جا نشوند و صفحه ثابت بماند. از مرکزِ مسیر فاصله
     * می‌گیرند تا روی گره‌ها و نام‌ها نیفتند.
     */
    const decor: DecorPoint[] = [];
    if (decorKinds.length > 0) {
      const count = Math.round(nodes.length * DECOR_PER_STAGE);
      for (let i = 0; i < count; i += 1) {
        const r1 = pseudo(i * 2 + 1);
        const r2 = pseudo(i * 2 + 2);
        const r3 = pseudo(i * 2 + 3);
        // نصفِ چپ یا راست، بیرونِ محدوده‌ی مسیر
        const leftSide = i % 2 === 0;
        const edge = DECOR_CLEARANCE + r1 * (0.5 - DECOR_CLEARANCE);
        decor.push({
          kind: decorKinds[i % decorKinds.length],
          x: leftSide ? centerX - edge * width : centerX + edge * width,
          y: height - BOTTOM_LEAD - r2 * (height - BOTTOM_LEAD - 20),
          scale: 0.65 + r3 * 0.7,
          delay: Math.round(r3 * 2600),
        });
      }
    }

    return {
      nodes,
      memories,
      decor,
      weekMarks,
      ghosts,
      trackPath: smoothPath(points),
      litPath: smoothPath(points.slice(0, litUpto + 1)),
      height,
      currentY: currentIndex >= 0 ? nodes[currentIndex].y : last.y,
    };
  }, [weeks, done, currentStageId, width, hasClouds, photoSpots, decorKinds]);
}
