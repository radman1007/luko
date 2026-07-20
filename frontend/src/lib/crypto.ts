/**
 * رمزنگاری سمت کلاینت برای «صندوقچه‌ی رازها»:
 * AES-256-GCM با کلید مشتق‌شده از رمز کاربر (PBKDF2 / SHA-256 / 150k تکرار).
 * متن راز هرگز به‌صورت خام ذخیره نمی‌شود؛ خروجی = base64(salt ‖ iv ‖ cipher)
 */
const ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoder.encode(plain)),
  );
  const payload = new Uint8Array(salt.length + iv.length + cipher.length);
  payload.set(salt, 0);
  payload.set(iv, salt.length);
  payload.set(cipher, salt.length + iv.length);
  return toBase64(payload);
}

/** در صورت رمز اشتباه یا داده‌ی خراب null برمی‌گرداند */
export async function decryptText(payload: string, password: string): Promise<string | null> {
  try {
    const bytes = fromBase64(payload);
    const salt = bytes.slice(0, SALT_BYTES);
    const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const cipher = bytes.slice(SALT_BYTES + IV_BYTES);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}
