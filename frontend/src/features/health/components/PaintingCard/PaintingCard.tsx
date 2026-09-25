import { useCallback, useEffect, useRef, useState } from 'react';
import { HiOutlineArrowsPointingIn, HiOutlineArrowsPointingOut } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { isGuestMode } from '@/features/auth/guest';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { saveArtEntry } from '../../artLog';
import { useSaveDrawing } from '../../useDrawings';
import { useDrawingSurface } from '../../useDrawingSurface';
import { exportDrawing, FULL, THUMB } from '../../drawingExport';
import type { Mood } from '../../types';
import { BRUSH_SIZES, COLORS, eraserWidth } from '../../paintingData';
import { PAPER } from '../../useDrawingSurface';
import { PaintingTools } from './PaintingTools';
import type { PaintTool } from './PaintingTools';
import styles from './PaintingCard.module.css';

export function PaintingCard() {
  const painter = LUKORIANS.art;
  const [expanded, setExpanded] = useState(false);
  const surface = useDrawingSurface(expanded);
  const cardRef = useRef<HTMLElement>(null);
  const shrinkRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  /**
   * جای کارت در صفحه وقتی بوم بزرگ است — وگرنه صفحه کوتاه می‌شد و اسکرول می‌پرید.
   * فاصله‌ی بالای کارت جدا نگه داشته می‌شود تا لبه‌ی بالای این جا دقیقاً همان
   * لبه‌ی کارت بماند؛ اگر در ارتفاع حساب می‌شد، مرورگر اسکرول را ۱۶px جابه‌جا می‌کرد.
   */
  const [placeholder, setPlaceholder] = useState<React.CSSProperties | null>(null);

  const [color, setColor] = useState(COLORS[4]);
  const [brush, setBrush] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<PaintTool>('pen');
  /** سطل کلِ نقاشی را می‌برد؛ یک ضربه‌ی اشتباه نباید کارِ بچه را پاک کند */
  const [confirmClear, setConfirmClear] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const saveDrawing = useSaveDrawing();

  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const usage = useRef<Record<string, number>>({});

  // بومِ بزرگ روی همه‌چیز می‌نشیند؛ صفحه‌ی پشتش نباید با کشیدنِ انگشت اسکرول شود
  useEffect(() => {
    if (!expanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    shrinkRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  const open = () => {
    const card = cardRef.current;
    if (card) {
      setPlaceholder({
        height: card.offsetHeight,
        marginTop: parseFloat(getComputedStyle(card).marginTop) || 0,
      });
    }
    setExpanded(true);
  };

  const close = useCallback(() => {
    setExpanded(false);
    setPlaceholder(null);
    // تمرکز به همان دکمه‌ای برمی‌گردد که بوم را بزرگ کرد
    requestAnimationFrame(() => expandRef.current?.focus({ preventScroll: true }));
  }, []);

  useEscapeKey(close);

  const getPos = (e: React.PointerEvent) => surface.toDoc(e.clientX, e.clientY);

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (tool === 'eraser') {
      surface.stroke(from, to, PAPER, eraserWidth(brush), true);
      return;
    }
    surface.stroke(from, to, color, brush);
    setIsEmpty(false);
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* برخی مرورگرها/رویدادهای مصنوعی capture را پشتیبانی نمی‌کنند */
    }
    drawing.current = true;
    last.current = getPos(e);
    if (tool === 'pen') usage.current[color] = (usage.current[color] ?? 0) + 1;
    setSavedCount(null);
    // نقطه‌ی تکی هم ثبت شود
    drawSegment(last.current, last.current);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const pos = getPos(e);
    drawSegment(last.current, pos);
    last.current = pos;
  };

  const handleUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const resetCanvas = () => {
    surface.clear();
    usage.current = {};
    setIsEmpty(true);
  };

  const clearCanvas = () => {
    resetCanvas();
    setSavedCount(null);
    setConfirmClear(false);
    setTool('pen');
  };

  // پرسشِ «همه‌ش پاک بشه؟» خودش بعد از چند ثانیه می‌رود
  useEffect(() => {
    if (!confirmClear) return undefined;
    const id = window.setTimeout(() => setConfirmClear(false), 5000);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  const handleSave = () => {
    const canvas = surface.canvasRef.current;
    if (!canvas || isEmpty) return;

    const mood = localStorage.getItem('luko_last_mood') as Mood | null;
    const colors = { ...usage.current };
    const thumbnail = exportDrawing(canvas, THUMB);

    // نسخه‌ی محلی همیشه نوشته می‌شود تا در قطعیِ شبکه چیزی از دست نرود
    const count = saveArtEntry({ at: Date.now(), mood, colors, thumbnail });

    // گالریِ پروفایل از سرور می‌آید؛ مهمان حسابِ سروری ندارد
    if (!isGuestMode()) {
      saveDrawing.mutate({ mood, colors, thumbnail, image: exportDrawing(canvas, FULL) });
    }

    resetCanvas();
    setSavedCount(count);
    setTool('pen');
  };

  return (
    <div style={placeholder ?? undefined}>
      <section
        ref={cardRef}
        className={`${styles.card} ${expanded ? styles.expanded : ''}`}
        aria-label={expanded ? 'بومِ بزرگِ نقاشی' : 'بوم نقاشی رنگو'}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
      >
        {/* نوارِ بالای بومِ بزرگ — جای حبابِ رنگو را می‌گیرد */}
        {expanded && (
          <div className={styles.studioBar}>
            <img className={styles.studioChar} src={painter.image} alt="" aria-hidden />
            <p className={styles.studioTitle}>
              بومِ بزرگِ {painter.name}
              <span className={styles.studioHint}>هر چی دلت می‌خواد، بزرگ بکش!</span>
            </p>
            <button ref={shrinkRef} type="button" className={styles.shrinkBtn} onClick={close}>
              <HiOutlineArrowsPointingIn aria-hidden />
              کوچیکش کن
            </button>
          </div>
        )}

        <div className={styles.head}>
          <img className={styles.character} src={painter.image} alt={painter.name} />
          <div className={styles.bubble}>
            <p className={styles.speaker}>
              {painter.name}، {painter.role}
            </p>
            <p className={styles.text}>امروز دلت چه رنگیه؟ هر چی دوست داری بکش رو بومِ من!</p>
            <span className={styles.tail} aria-hidden />
          </div>
        </div>

        <div ref={surface.wrapRef} className={styles.canvasWrap}>
          <canvas
            ref={surface.canvasRef}
            className={`${styles.canvas} ${tool === 'eraser' ? styles.erasing : ''}`}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            aria-label="بوم نقاشی"
          />
          {confirmClear && (
            <div className={styles.confirmClear} role="alertdialog" aria-label="پاک کردنِ همه‌ی نقاشی">
              <span className={styles.confirmText}>کلِ نقاشی پاک بشه؟</span>
              <button type="button" className={styles.confirmYes} onClick={clearCanvas}>
                آره، همه‌ش
              </button>
              <button type="button" className={styles.confirmNo} onClick={() => setConfirmClear(false)}>
                نه
              </button>
            </div>
          )}
          {!expanded && (
            <button ref={expandRef} type="button" className={styles.expandBtn} onClick={open}>
              <HiOutlineArrowsPointingOut aria-hidden />
              بزرگش کن
            </button>
          )}
        </div>

        <PaintingTools
          color={color}
          brush={brush}
          tool={tool}
          isEmpty={isEmpty}
          onColor={setColor}
          onBrush={setBrush}
          onTool={setTool}
          onClear={() => setConfirmClear(true)}
          onSave={handleSave}
        />

        {savedCount !== null && (
          <p className={styles.savedMsg} role="status">
            {painter.name}: چه شاهکاری! گذاشتمش تو گنجینه‌م ({savedCount.toLocaleString('fa-IR')}{' '}
            نقاشی)
          </p>
        )}
      </section>
    </div>
  );
}
