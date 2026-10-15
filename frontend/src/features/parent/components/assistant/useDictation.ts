import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * گفتن به‌جای نوشتن، با تشخیصِ گفتارِ خودِ مرورگر (Web Speech API، زبانِ fa-IR).
 * گیت‌وی هوش مصنوعیِ ما مدلِ گفتار‌به‌متن ندارد (آزمونِ ۲۴ مهر ۱۴۰۵: /audio/transcriptions «model not found»)؛
 * پس هر جا مرورگر پشتیبانی نکند (WebViewِ اندروید، فایرفاکس) دکمه‌ی میکروفون اصلاً نشان داده نمی‌شود.
 * صدا در مرورگر به متن می‌شود و فقط متن به لوکو می‌آید.
 */

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'اجازه‌ی میکروفون داده نشد؛ از تنظیماتِ مرورگر اجازه دهید.',
  'service-not-allowed': 'تبدیلِ صدا به متن در این مرورگر بسته است.',
  network: 'تبدیلِ صدا به متن الان در دسترس نیست؛ پرسش را بنویسید.',
  'no-speech': 'صدایی شنیده نشد؛ دوباره امتحان کنید.',
  'audio-capture': 'میکروفونی پیدا نشد.',
};

/** `onText(متن)` با هر تکه‌ی قطعی صدا زده می‌شود؛ `interim` متنِ در حالِ شنیدن است */
export function useDictation(onText: (text: string) => void) {
  const supported = recognitionCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => ref.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || ref.current) return;
    const recognition = new Ctor();
    recognition.lang = 'fa-IR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) onTextRef.current(text.trim());
        else live += text;
      }
      setInterim(live.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERRORS[event.error] ?? 'صدا به متن تبدیل نشد؛ دوباره امتحان کنید.');
    };
    recognition.onend = () => {
      ref.current = null;
      setListening(false);
      setInterim('');
    };
    setError('');
    ref.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      ref.current = null;
      setError('میکروفون شروع نشد؛ دوباره امتحان کنید.');
    }
  }, []);

  // ترکِ صفحه وسطِ شنیدن
  useEffect(() => () => ref.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, clearError: () => setError('') };
}
