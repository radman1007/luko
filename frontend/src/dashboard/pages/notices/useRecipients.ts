import { useEffect, useState } from 'react';
import { messageOf, send } from '../../lib/api';

export interface Preview {
  count: number;
  sample: string[];
  label: string;
}

/** شمارِ گیرندگان با هر تغییرِ فیلتر (با درنگ، تا با هر کلیک درخواست نرود) */
export function useRecipients(audience: string, filters: Record<string, string>) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(filters);
  useEffect(() => {
    if (!audience) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      send<Preview>('post', 'notices/preview', { audience, filters: JSON.parse(key) })
        .then((p) => { if (alive) { setPreview(p); setError(''); } })
        .catch((e: unknown) => alive && setError(messageOf(e)));
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [audience, key]);
  return { preview: audience ? preview : null, error };
}
