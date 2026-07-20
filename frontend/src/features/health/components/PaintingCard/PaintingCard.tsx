import { useEffect, useRef, useState } from 'react';
import { HiOutlineCheck, HiOutlineTrash } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { saveArtEntry } from '../../artLog';
import type { Mood } from '../../types';
import styles from './PaintingCard.module.css';

const COLORS = [
  '#e5484d',
  '#f2994a',
  '#f2c230',
  '#2e9e5b',
  '#4696e5',
  '#8f6bc9',
  '#e56fa7',
  '#1d2128',
];

const BRUSH_SIZES = [4, 9, 16];
const CANVAS_HEIGHT = 240;

export function PaintingCard() {
  const painter = LUKORIANS.art;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [color, setColor] = useState(COLORS[4]);
  const [brush, setBrush] = useState(BRUSH_SIZES[1]);
  const [isEmpty, setIsEmpty] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const usage = useRef<Record<string, number>>({});

  // بوم به اندازه‌ی ظرف و متناسب با تراکم پیکسل صفحه آماده می‌شود
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    canvas.width = width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* برخی مرورگرها/رویدادهای مصنوعی capture را پشتیبانی نمی‌کنند */
    }
    drawing.current = true;
    last.current = getPos(e);
    usage.current[color] = (usage.current[color] ?? 0) + 1;
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

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = brush;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    usage.current = {};
    setIsEmpty(true);
  };

  const clearCanvas = () => {
    resetCanvas();
    setSavedCount(null);
  };

  const makeThumbnail = (canvas: HTMLCanvasElement): string => {
    const thumb = document.createElement('canvas');
    const width = 120;
    thumb.width = width;
    thumb.height = Math.round((canvas.height / canvas.width) * width);
    thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL('image/jpeg', 0.6);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    const count = saveArtEntry({
      at: Date.now(),
      mood: localStorage.getItem('luko_last_mood') as Mood | null,
      colors: { ...usage.current },
      thumbnail: makeThumbnail(canvas),
    });
    resetCanvas();
    setSavedCount(count);
  };

  return (
    <section className={styles.card} aria-label="بوم نقاشی رنگو">
      <div className={styles.head}>
        <img className={styles.character} src={painter.image} alt={painter.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{painter.name}، {painter.role}</p>
          <p className={styles.text}>امروز دلت چه رنگیه؟ هر چی دوست داری بکش رو بومِ من!</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div ref={wrapRef} className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          aria-label="بوم نقاشی"
        />
      </div>

      <div className={styles.palette} role="group" aria-label="انتخاب رنگ">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${c === color ? styles.selected : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`رنگ ${c}`}
            aria-pressed={c === color}
          />
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.brushes} role="group" aria-label="اندازه قلم">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`${styles.brushBtn} ${size === brush ? styles.brushActive : ''}`}
              onClick={() => setBrush(size)}
              aria-label={`قلم ${size}`}
              aria-pressed={size === brush}
            >
              <span
                className={styles.brushDot}
                style={{ width: size + 4, height: size + 4, background: color }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={clearCanvas}
          disabled={isEmpty}
          aria-label="پاک کردن بوم"
        >
          <HiOutlineTrash />
        </button>

        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={isEmpty}>
          <HiOutlineCheck aria-hidden />
          تمومه، نگهش دار!
        </button>
      </div>

      {savedCount !== null && (
        <p className={styles.savedMsg}>
          {painter.name}: چه شاهکاری! گذاشتمش تو گنجینه‌م ({savedCount.toLocaleString('fa-IR')}{' '}
          نقاشی)
        </p>
      )}
    </section>
  );
}
