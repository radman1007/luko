/** تاریخِ محلی به شکلِ YYYY-MM-DD (همان شکلِ «بازیِ روز» در سرور)؛ offset به روز */
export function localDate(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
