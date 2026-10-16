/**
 * متنِ پاسخِ دستیار: «**پررنگ**» و فهرستِ «• » — بی‌HTML، فقط متن (پاسخِ مدل هرگز به‌صورتِ HTML نشانده نمی‌شود).
 * استایل با کلاسِ والد (پاراگراف‌ها، ul و b).
 */
export function RichText({ text }: { text: string }) {
  const bold = (line: string) => line.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const list = line.startsWith('• ');
    const last = blocks[blocks.length - 1];
    const value = list ? line.slice(2) : line;
    if (last && last.list && list) last.lines.push(value);
    else blocks.push({ list, lines: [value] });
  }
  return (
    <>
      {blocks.map((block, index) => (block.list ? (
        <ul key={index}>{block.lines.map((line, i) => <li key={i}>{bold(line)}</li>)}</ul>
      ) : (
        block.lines.map((line, i) => <p key={`${index}-${i}`}>{bold(line)}</p>)
      )))}
    </>
  );
}
