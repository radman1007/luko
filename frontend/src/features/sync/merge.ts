/**
 * ادغامِ سه‌طرفه‌ی یک کلید: پایه (آخرین مقدارِ هم‌رسان‌شده روی همین دستگاه)،
 * مقدارِ همین دستگاه، و مقدارِ سرور.
 *
 * فقط یک طرف عوض شده؟ همان می‌ماند. هر دو عوض شده‌اند؟ قاعده‌ی کلید تصمیم
 * می‌گیرد — مثلاً سکه‌ای که روی گوشی گرفته شده به سکه‌ای که همان وقت روی سایت
 * گرفته شده **اضافه** می‌شود، نه اینکه یکی جای دیگری را بگیرد.
 *
 * بی‌پایه (بارِ اولی که این دستگاه با این حساب هم‌رسان می‌شود) تاریخچه‌ی
 * مشترکی نیست که تفاوت را از آن حساب کنیم؛ آن‌وقت محتاطانه ادغام می‌کنیم:
 * بیشینه‌ی موجودی‌ها (نه جمعشان، که سکه دوبل نشود)، اجتماعِ فهرست‌ها، و
 * باغچه‌ی پربارتر.
 *
 * مقدارها همان رشته‌ی localStorage‌اند؛ null یعنی «نیست/پاک شده».
 */
import type { Strategy } from './syncKeys';

type Raw = string | null;

export function mergeValue(strategy: Strategy, base: Raw | undefined, local: Raw, server: Raw): Raw {
  if (local === server) return local;
  if (base !== undefined) {
    if (local === base) return server;
    if (server === base) return local;
  }
  try {
    return mergeBoth(strategy, base, local, server);
  } catch {
    // مقدارِ خراب (JSONِ نیمه‌کاره): نسخه‌ی همین دستگاه
    return local ?? server;
  }
}

function mergeBoth(strategy: Strategy, base: Raw | undefined, local: Raw, server: Raw): Raw {
  // یک طرف پاکش کرده و طرفِ دیگر عوضش کرده: عوض‌شده برنده است (چیزی گم نشود)
  if (local === null) return server;
  if (server === null) return local;

  switch (strategy) {
    case 'counter':
      return String(mergeNumber(num(base), num(local), num(server)));
    case 'max':
      return String(Math.max(num(local) ?? 0, num(server) ?? 0));
    case 'set':
      return JSON.stringify(mergeSet(parseList<string>(base), parseList<string>(local)!, parseList<string>(server)!, String));
    case 'list-id':
      return JSON.stringify(mergeSet(parseList<Keyed>(base), parseList<Keyed>(local)!, parseList<Keyed>(server)!, (x) => String(x.id)));
    case 'list-at':
      return JSON.stringify(
        mergeSet(parseList<Keyed>(base), parseList<Keyed>(local)!, parseList<Keyed>(server)!, (x) => String(x.at))
          .sort((a, b) => Number(b.at) - Number(a.at)),
      );
    case 'object':
      return JSON.stringify(mergeObject(parseObj(base), parseObj(local)!, parseObj(server)!, !base));
    case 'garden':
      return JSON.stringify(mergeGarden(parseObj(base), parseObj(local)!, parseObj(server)!));
    case 'flag':
    case 'scalar':
    default:
      // بی‌پایه: نسخه‌ی حساب (دستگاهِ دیگر زودتر فرستاده)؛ با پایه: آخرین تغییرِ همین‌جا
      return base === undefined ? server : local;
  }
}

type Keyed = { id?: unknown; at?: unknown } & Record<string, unknown>;
type Obj = Record<string, unknown>;

const num = (raw: Raw | undefined): number | null => {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

function parseList<T>(raw: Raw | undefined): T[] | null {
  if (raw === null || raw === undefined) return null;
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) throw new Error('not a list');
  return value as T[];
}

function parseObj(raw: Raw | undefined): Obj | null {
  if (raw === null || raw === undefined) return null;
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
  return value as Obj;
}

/** تغییرِ هر دو طرف نسبت به پایه جمع می‌شود؛ بی‌پایه بیشینه (دوبل‌نشدن). منفی نمی‌شود. */
export function mergeNumber(base: number | null, local: number | null, server: number | null): number {
  const l = local ?? 0;
  const s = server ?? 0;
  if (base === null) return Math.max(l, s);
  return Math.max(0, s + (l - base));
}

/**
 * مجموعه‌ی سه‌طرفه: آنچه یک طرف حذف کرده می‌رود، آنچه یک طرف اضافه کرده می‌ماند.
 * ترتیبِ سرور حفظ می‌شود و تازه‌های این دستگاه ته‌اش می‌آیند. برای شیءِ
 * مشترک، نسخه‌ی همین دستگاه.
 */
export function mergeSet<T>(base: T[] | null, local: T[], server: T[], id: (x: T) => string): T[] {
  const localIds = new Set(local.map(id));
  const serverIds = new Set(server.map(id));
  const baseIds = new Set((base ?? []).map(id));
  const localById = new Map(local.map((x) => [id(x), x]));
  const removedHere = base ? new Set([...baseIds].filter((k) => !localIds.has(k))) : new Set<string>();

  const out: T[] = [];
  const taken = new Set<string>();
  for (const item of server) {
    const k = id(item);
    if (removedHere.has(k) || taken.has(k)) continue;
    out.push(localById.get(k) ?? item);
    taken.add(k);
  }
  for (const item of local) {
    const k = id(item);
    if (taken.has(k)) continue;
    // در پایه بود و سرور ندارد → آن‌جا حذف شده
    if (base && baseIds.has(k) && !serverIds.has(k)) continue;
    out.push(item);
    taken.add(k);
  }
  return out;
}

/**
 * هر فیلد جدا: فیلدی که همین دستگاه عوض (یا پاک) کرده برنده است، وگرنه نسخه‌ی
 * سرور. بی‌پایه → حساب (سرور) یا همین دستگاه، به انتخابِ صدازننده.
 */
export function mergeObject(base: Obj | null, local: Obj, server: Obj, preferServer: boolean): Obj {
  if (!base) return preferServer ? { ...local, ...server } : { ...server, ...local };
  const out: Obj = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)])) {
    const changedHere = JSON.stringify(local[key]) !== JSON.stringify(base[key]);
    const source = changedHere ? local : server;
    if (key in source) out[key] = source[key]; // نبودنش یعنی همان طرف پاکش کرده
  }
  return out;
}

interface PlantLike {
  id: string;
  care?: number;
  [k: string]: unknown;
}

/** امتیازِ «پرباری» برای وقتی که تاریخچه‌ی مشترکی نیست */
function gardenScore(g: Obj): number {
  const plants = Array.isArray(g.plants) ? (g.plants as PlantLike[]) : [];
  return (Number(g.plotLevel) || 0) * 1000
    + plants.reduce((sum, p) => sum + (Number(p.care) || 0), 0) * 10
    + (Array.isArray(g.decor) ? g.decor.length : 0) * 50
    + (Number(g.dew) || 0);
}

/**
 * باغچه: موجودی‌ها (شبنم، کود، دانه، شارژِ آب‌پاش) جمعِ تغییرها، سطح بیشینه،
 * زمان‌ها آخرین، تزئین‌ها مجموعه، گیاه‌ها به شناسه با جمعِ مراقبت.
 * بی‌پایه: باغچه‌ی پربارتر کامل انتخاب می‌شود — دو باغچه‌ی جدا را نمی‌شود
 * روی هم ریخت (گیاه‌ها از جایشان بیشتر می‌شدند).
 */
export function mergeGarden(base: Obj | null, local: Obj, server: Obj): Obj {
  if (!base) return gardenScore(local) > gardenScore(server) ? local : server;

  const out: Obj = mergeObject(base, local, server, false);
  const n = (o: Obj, k: string) => (typeof o[k] === 'number' ? (o[k] as number) : null);
  for (const key of ['dew', 'fertilizer', 'seeds']) {
    out[key] = mergeNumber(n(base, key), n(local, key), n(server, key));
  }
  // شارژِ آب‌پاش سقف دارد: اگر هر دو پر شده‌اند جمعشان از پُرترین بیشتر نشود
  out.waterCharges = Math.min(
    mergeNumber(n(base, 'waterCharges'), n(local, 'waterCharges'), n(server, 'waterCharges')),
    Math.max(n(local, 'waterCharges') ?? 0, n(server, 'waterCharges') ?? 0),
  );
  out.plotLevel = Math.max(n(local, 'plotLevel') ?? 1, n(server, 'plotLevel') ?? 1);
  for (const key of ['lastRefillAt', 'seasonStartAt', 'lastWateredAt']) {
    const values = [local[key], server[key]].filter((v): v is number => typeof v === 'number');
    out[key] = values.length ? Math.max(...values) : (local[key] ?? server[key] ?? null);
  }
  const list = <T>(o: Obj, k: string) => (Array.isArray(o[k]) ? (o[k] as T[]) : []);
  out.decor = mergeSet(list<string>(base, 'decor'), list<string>(local, 'decor'), list<string>(server, 'decor'), String);
  // دفترچه‌ی «آخرین شبنم‌ها» دیگر نیست؛ نسخه‌ی کهنه‌اش هم هم‌رسان نمی‌شود
  delete out.dewLog;

  const basePlants = new Map(list<PlantLike>(base, 'plants').map((p) => [p.id, p]));
  const serverPlants = new Map(list<PlantLike>(server, 'plants').map((p) => [p.id, p]));
  const plants = mergeSet(
    list<PlantLike>(base, 'plants'), list<PlantLike>(local, 'plants'), list<PlantLike>(server, 'plants'),
    (p) => p.id,
  ).map((plant) => {
    const b = basePlants.get(plant.id);
    const s = serverPlants.get(plant.id);
    if (!b || !s) return plant;
    // مراقبتی که هر دو دستگاه کرده‌اند جمع می‌شود
    return { ...plant, care: mergeNumber(b.care ?? 0, plant.care ?? 0, s.care ?? 0) };
  });
  out.plants = plants;
  return out;
}
