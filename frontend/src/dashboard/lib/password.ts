/** رمزِ تصادفیِ قوی (۱۴ نویسه، بی‌حروفِ گیج‌کننده مثلِ l/1/O/0) با cryptoِ مرورگر */
export function strongPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
