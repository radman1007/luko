import { useCallback, useState } from 'react';
import { decryptText, encryptText } from '@/lib/crypto';
import type { SecretEntry } from './types';

const SECRETS_KEY = 'luko_secrets';

function load(): SecretEntry[] {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (raw) return JSON.parse(raw) as SecretEntry[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

function persist(secrets: SecretEntry[]) {
  localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
}

/**
 * صندوقچه‌ی رازها — هر راز با رمز خود بچه AES-GCM رمزنگاری می‌شود؛
 * بدون رمز درست نه خواندن ممکن است نه حذف. (TODO: sync با بک‌اند)
 */
export function useSecrets() {
  const [secrets, setSecrets] = useState<SecretEntry[]>(load);

  const add = useCallback(async (title: string, text: string, password: string) => {
    const payload = await encryptText(text, password);
    setSecrets((prev) => {
      const next = [
        { id: crypto.randomUUID(), title, payload, createdAt: Date.now() },
        ...prev,
      ];
      persist(next);
      return next;
    });
  }, []);

  const unlock = useCallback(
    async (id: string, password: string): Promise<string | null> => {
      const secret = secrets.find((s) => s.id === id);
      if (!secret) return null;
      return decryptText(secret.payload, password);
    },
    [secrets],
  );

  /** حذف فقط با رمز درست انجام می‌شود */
  const remove = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      const secret = secrets.find((s) => s.id === id);
      if (!secret) return false;
      const plain = await decryptText(secret.payload, password);
      if (plain === null) return false;
      setSecrets((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persist(next);
        return next;
      });
      return true;
    },
    [secrets],
  );

  return { secrets, add, unlock, remove };
}
