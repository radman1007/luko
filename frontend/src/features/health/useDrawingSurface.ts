import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** ارتفاعِ بوم در کارت، پیش از اینکه بچه آن را بزرگ کند */
const INLINE_HEIGHT = 240;
/** نقاشی‌ای که در بومِ بزرگ کشیده شده، در کارت حداکثر با این ارتفاع دیده می‌شود */
const INLINE_MAX_HEIGHT = 420;
/** سقفِ پیکسل‌های پشتِ بوم — وب‌ویو و سافاری بومِ خیلی بزرگ را سفید نشان می‌دهند */
const MAX_BACKING_PIXELS = 12_000_000;
/** رنگِ کاغذ — زمینه‌ی بوم و رنگِ پاک‌کن */
export const PAPER = '#ffffff';

interface Point {
  x: number;
  y: number;
}

interface Doc {
  /** اندازه‌ی نقاشی به واحدِ CSS px (مستقل از اینکه الان چقدر بزرگ دیده می‌شود) */
  w: number;
  h: number;
  /** پیکسلِ واقعی به‌ازای هر واحد */
  ratio: number;
}

/**
 * بومِ نقاشی به‌عنوانِ یک «سند»: نقاشی اندازه‌ی خودش را دارد و بوم فقط آن را
 * در جایی که هست (کارت یا بومِ تمام‌صفحه) جا می‌دهد.
 *
 * بزرگ و کوچک کردنِ بوم، چرخاندنِ تبلت و عوض‌شدنِ ستون هیچ‌کدام چیزی از
 * نقاشی پاک نمی‌کنند:
 * - رفتن به بومِ بزرگ: سند هم‌شکلِ صفحه می‌شود و نقاشیِ قبلی وسطش می‌نشیند.
 * - برگشتن به کارت: همان سند کوچک‌تر نشان داده می‌شود.
 * - اگر جای نمایش از خودِ سند بزرگ‌تر شد، وضوحِ سند بالا می‌رود تا تار نشود.
 * بومِ خالی همیشه هم‌اندازه‌ی جای خودش ساخته می‌شود.
 */
export function useDrawingSurface(expanded: boolean) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doc = useRef<Doc>({ w: 0, h: 0, ratio: 1 });
  const drawn = useRef(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  /** جای خالیِ نمایش؛ در کارت ارتفاع از شکلِ خودِ نقاشی می‌آید */
  const frame = useCallback((): { w: number; h: number } => {
    const wrap = wrapRef.current;
    if (!wrap) return { w: 0, h: 0 };
    if (expandedRef.current) {
      const cs = getComputedStyle(wrap);
      return {
        w: wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      };
    }
    const w = wrap.clientWidth;
    const { w: dw, h: dh } = doc.current;
    const h = drawn.current && dw ? Math.min((w * dh) / dw, INLINE_MAX_HEIGHT) : INLINE_HEIGHT;
    return { w, h };
  }, []);

  /** سندِ تازه به اندازه‌ی w×h؛ نقاشیِ قبلی یا وسطش می‌نشیند یا کش می‌آید تا پُرش کند */
  const setDoc = useCallback(
    (width: number, height: number, place: 'blank' | 'center' | 'stretch') => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      // اندازه و جابه‌جایی پیکسلِ درست باشند؛ نیم‌پیکسل خط‌های قبلی را تار می‌کرد
      const w = Math.round(width);
      const h = Math.round(height);
      if (!canvas || !ctx || w <= 0 || h <= 0) return;

      const old = doc.current;
      let previous: HTMLCanvasElement | null = null;
      if (place !== 'blank' && old.w > 0) {
        previous = document.createElement('canvas');
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      const ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_BACKING_PIXELS / (w * h)));
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);
      if (previous) {
        if (place === 'stretch') ctx.drawImage(previous, 0, 0, w, h);
        else
          ctx.drawImage(
            previous,
            Math.round((w - old.w) / 2),
            Math.round((h - old.h) / 2),
            old.w,
            old.h,
          );
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      doc.current = { w, h, ratio };
    },
    [],
  );

  /** سند را در جای نمایش جا می‌دهد (بدونِ بریدن) */
  const layout = useCallback(() => {
    const canvas = canvasRef.current;
    const box = frame();
    if (!canvas || box.w <= 0 || box.h <= 0) return;

    // بومِ خالی شکلِ جای خودش را می‌گیرد
    if (
      !drawn.current &&
      (Math.abs(doc.current.w - box.w) > 0.5 || Math.abs(doc.current.h - box.h) > 0.5)
    ) {
      setDoc(box.w, box.h, 'blank');
    }

    const { w, h } = doc.current;
    const scale = Math.min(box.w / w, box.h / h);
    if (scale > 1.01) setDoc(w * scale, h * scale, 'stretch');

    const shown = Math.min(scale, 1);
    canvas.style.width = `${doc.current.w * shown}px`;
    canvas.style.height = `${doc.current.h * shown}px`;
  }, [frame, setDoc]);

  // رفتن به بومِ بزرگ یا برگشتن از آن (و بارِ اول، ساختنِ بوم)
  useLayoutEffect(() => {
    if (expanded && drawn.current) {
      const box = frame();
      const { w, h } = doc.current;
      if (box.w > 0 && box.h > 0) {
        // اگر نقاشیِ فعلی از صفحه بزرگ‌تر بود، سند بزرگ‌تر از صفحه می‌ماند تا چیزی بریده نشود
        const k = Math.max(1, w / box.w, h / box.h);
        setDoc(box.w * k, box.h * k, 'center');
      }
    }
    layout();
  }, [expanded, frame, layout, setDoc]);

  // چرخاندنِ تبلت، عوض‌شدنِ ستون، باز و بسته شدنِ نوارها
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const observer = new ResizeObserver(() => layout());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [layout]);

  /** مختصاتِ لمس روی سند */
  const toDoc = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * doc.current.w) / rect.width,
      y: ((clientY - rect.top) * doc.current.h) / rect.height,
    };
  }, []);

  /**
   * یک تکه خط؛ ضخامتِ قلم روی صفحه همان است که بچه انتخاب کرده، هر قدر هم سند بزرگ باشد.
   * پاک‌کن همان خط است به رنگِ کاغذ (`PAPER`)؛ خروجیِ نقاشی هم روی همین کاغذِ سفید است.
   */
  const stroke = useCallback((from: Point, to: Point, color: string, brush: number, erase = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = color;
    ctx.lineWidth = rect.width ? (brush * doc.current.w) / rect.width : brush;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    // پاک‌کردن روی بومِ خالی آن را «کشیده‌شده» نمی‌کند
    if (!erase) drawn.current = true;
  }, []);

  /** بومِ سفیدِ تازه، هم‌اندازه‌ی جای فعلی‌اش */
  const clear = useCallback(() => {
    drawn.current = false;
    const box = frame();
    setDoc(box.w, box.h, 'blank');
    layout();
  }, [frame, layout, setDoc]);

  return { wrapRef, canvasRef, toDoc, stroke, clear };
}
