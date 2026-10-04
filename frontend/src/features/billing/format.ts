/** «۲۹۹٬۰۰۰» — رقم و جداکننده‌ی فارسی */
export function faNumber(value: number): string {
  return value.toLocaleString('fa-IR');
}

/** «۲۹۹٬۰۰۰ تومان» */
export function toman(value: number): string {
  return `${faNumber(value)} تومان`;
}

/** پیامِ خطای پاکتِ API برای نمایش */
export function apiMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { error?: { message?: string } } } })?.response
    ?.data?.error?.message;
  return message || fallback;
}
