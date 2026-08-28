/**
 * هندسه‌ی نقشه‌ی سیزن.
 *
 * مرحله‌ها روی یک مسیرِ مارپیچ از **پایین به بالا** می‌نشینند: مرحله‌ی ۱ کفِ
 * نقشه است و هرچه بالاتر می‌روی جلوتری. مسیر یک منحنیِ پیوسته‌ی SVG است که
 * از میانِ مرکزِ گره‌ها رد می‌شود، پس ریاضیش اینجاست و کامپوننت فقط رسم می‌کند.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SeasonStage, SeasonWeek } from './seasonData';

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

export interface SeasonMapGeometry {
  nodes: MapNode[];
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
      return { nodes, weekMarks, ghosts: [], trackPath: '', litPath: '', height };
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

    return {
      nodes,
      weekMarks,
      ghosts,
      trackPath: smoothPath(points),
      litPath: smoothPath(points.slice(0, litUpto + 1)),
      height,
      currentY: currentIndex >= 0 ? nodes[currentIndex].y : last.y,
    };
  }, [weeks, done, currentStageId, width, hasClouds]);
}
