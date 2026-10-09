import { useEffect, useRef, useState } from 'react';
import { send } from '../../lib/api';

/** پیش‌نمایشِ HTML از سرور (همان مبدلِ امنِ سایتِ لندینگ)، با درنگ */
export function usePreview(body: string) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      send<{ html: string }>('post', 'blog/preview', { body }).then((r) => setHtml(r.html)).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [body]);
  return html;
}

/** درج در جای مکان‌نما؛ قلاب برای دکمه‌های نوارِ ابزار */
export function useInserter(value: string, onChange: (next: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (before: string, after = '', placeholder = '') => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const picked = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + picked + after + value.slice(end);
    onChange(next);
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, start + before.length + picked.length);
    });
  };
  const line = (prefix: string, placeholder: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const needsBreak = lineStart === start && start > 0 && value[start - 1] !== '\n';
    onChange(value.slice(0, lineStart) + (needsBreak ? '\n' : '') + prefix + (value.slice(lineStart, start) ? '' : placeholder) + value.slice(lineStart));
    window.requestAnimationFrame(() => el?.focus());
  };
  return { ref, wrap, line };
}
