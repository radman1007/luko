/**
 * قراردادِ رویدادها بینِ بازی و سایت: SDKِ واقعی (public/games/assets/luko-sdk.js) در یک
 * محیطِ جدا اجرا می‌شود، یک بازیِ کوتاه انجام می‌دهد، و هر رویدادی که می‌فرستد با همان
 * JSON Schemaای سنجیده می‌شود که تیمِ بازی‌سازی می‌خواند (docs/telemetry/game-event.schema.json).
 * اگر SDK و سند از هم جدا شوند، این تست می‌افتد.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../../../..');
const SDK = readFileSync(resolve(ROOT, 'frontend/public/games/assets/luko-sdk.js'), 'utf8');
const SCHEMA = JSON.parse(readFileSync(resolve(ROOT, 'docs/telemetry/game-event.schema.json'), 'utf8'));
const EXAMPLE = JSON.parse(readFileSync(resolve(ROOT, 'docs/telemetry/game-event.example.json'), 'utf8'));

type Json = Record<string, unknown>;
interface Message { type: string; event?: Json; summary?: Json; sessionId?: string }

/** زیرمجموعه‌ی JSON Schema که سندِ ما به‌کار می‌برد — کافی برای سنجیدنِ قرارداد */
function validate(schema: Json, value: unknown, path = '$'): string[] {
  const errors: string[] = [];
  const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array'
    : typeof v === 'number' && Number.isInteger(v) ? 'integer' : typeof v);
  if ('const' in schema && value !== schema.const) errors.push(`${path}: باید ${String(schema.const)} باشد`);
  if (schema.type) {
    const allowed = ([] as string[]).concat(schema.type as string | string[]);
    const actual = typeOf(value);
    if (!allowed.includes(actual) && !(actual === 'integer' && allowed.includes('number'))) {
      errors.push(`${path}: نوعِ ${actual}، انتظار ${allowed.join('|')}`);
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${path}: خارج از فهرست (${String(value)})`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern as string).test(value)) errors.push(`${path}: شکلِ «${value}» درست نیست`);
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) errors.push(`${path}: خالی است`);
  }
  if (typeof value === 'number' && typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push(`${path}: کمتر از ${schema.minimum}`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Json;
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in obj) || obj[key] === undefined) errors.push(`${path}.${key}: لازم است`);
    }
    const props = (schema.properties as Record<string, Json> | undefined) ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj && obj[key] !== undefined) errors.push(...validate(sub, obj[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!(key in props)) errors.push(`${path}.${key}: کلیدِ ناشناخته`);
    }
  }
  for (const rule of (schema.allOf as Json[] | undefined) ?? []) {
    const cond = rule.if as Json | undefined;
    if (cond && validate(cond, value, path).length === 0 && rule.then) {
      errors.push(...validate(rule.then as Json, value, path));
    }
  }
  return errors;
}

/** SDK را در یک «iframe»ِ ساختگی اجرا می‌کند و پیام‌هایش را جمع می‌کند */
function runSdk(search = '') {
  const messages: Message[] = [];
  const logs: string[] = [];
  const noop = () => 0;
  const listeners: Record<string, Array<() => void>> = {};
  const window: Json = {
    location: { pathname: '/games/C2KrF1S1G1.html', search, origin: 'https://my.luko.ir' },
    crypto: webcrypto,
    parent: { postMessage: (data: Message) => messages.push(JSON.parse(JSON.stringify(data))) },
    addEventListener: (name: string, fn: () => void) => { (listeners[name] ||= []).push(fn); },
    setTimeout: noop, setInterval: noop, clearInterval: noop,
  };
  const context = vm.createContext({
    window,
    document: { readyState: 'loading', addEventListener: noop, visibilityState: 'visible', querySelectorAll: () => [] },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13)' },
    localStorage: { getItem: () => '1', setItem: noop },
    location: window.location,
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push(`WARN ${args.map(String).join(' ')}`),
    },
    setTimeout: noop, setInterval: noop, clearInterval: noop,
    Uint8Array, Date, Math, JSON, Object, Array, String, Number, isFinite,
  });
  vm.runInContext(SDK, context);
  return { LUKO: (window as { LUKO: Record<string, (...a: unknown[]) => unknown> }).LUKO, messages, logs };
}

const events = (messages: Message[]) => messages.filter((m) => m.type === 'luko-game-event').map((m) => m.event as Json);

describe('قراردادِ رویدادِ بازی (SDK ↔ JSON Schema)', () => {
  it('نمونه‌ی سند خودش معتبر است', () => {
    expect(validate(SCHEMA, EXAMPLE)).toEqual([]);
  });

  it('هر رویدادی که SDK در یک بازیِ کامل می‌فرستد معتبر است', () => {
    const { LUKO, messages } = runSdk();
    LUKO.init({ gameType: 'quiz', totalLevels: 2 });
    LUKO.startLevel(1, { title: 'مرحله‌ی ۱', concept: 'addition_2digit' });
    LUKO.question('q1');
    LUKO.answer({ correct: false, questionId: 'q1', errorType: 'conceptual', given: 35, expected: 53 });
    LUKO.hint();
    LUKO.answer({ correct: true, questionId: 'q1' });
    LUKO.mistake({ errorType: 'timeout', reason: 'clock' });
    LUKO.levelComplete({ score: 10 });
    LUKO.startLevel(2, { concept: 'subtraction_2digit' });
    LUKO.answer({ concept: 'subtraction_2digit', correct: true, questionId: 'q2', timeMs: 3200 });
    LUKO.levelComplete({ score: 10 });

    const sent = events(messages);
    expect(sent.length).toBeGreaterThan(8);
    for (const event of sent) expect(validate(SCHEMA, event), String(event.event_type)).toEqual([]);
    // هر رویداد شناسه‌ی یکتای خودش را دارد و همه یک جلسه‌اند
    expect(new Set(sent.map((e) => e.event_id)).size).toBe(sent.length);
    expect(new Set(sent.map((e) => e.session_id)).size).toBe(1);
    expect(messages.some((m) => m.type === 'luko-game-complete')).toBe(true);
  });

  it('پاسخ‌ها: تگ، شماره‌ی تلاش و نوعِ خطا درست پر می‌شوند', () => {
    const { LUKO, messages } = runSdk();
    LUKO.question('q7', { concept: 'addition_2digit' });
    LUKO.answer({ correct: false, questionId: 'q7', errorType: 'careless' });
    LUKO.answer({ correct: true, questionId: 'q7', errorType: 'careless' });   // درست: نوعِ خطا ندارد
    LUKO.answer({ topic: 'count', correct: true });                              // نامِ قدیمی، بی‌شماره‌ی تلاش
    const answers = events(messages).filter((e) => e.event_type === 'answer');
    expect(answers.map((e) => [e.concept_tag, (e.data as Json).attempt_number, (e.data as Json).error_type])).toEqual([
      ['addition_2digit', 1, 'careless'],
      ['addition_2digit', 2, undefined],
      ['count', undefined, undefined],
    ]);
    for (const e of answers) expect(typeof (e.data as Json).time_taken_ms).toBe('number');
  });

  it('سطحِ مرحله زمانِ فعال را در duration_ms می‌فرستد و خلاصه جلسه را دارد', () => {
    const { LUKO, messages } = runSdk();
    LUKO.init({ totalLevels: 1 });
    LUKO.startLevel(1);
    LUKO.levelComplete({});
    const levelEnd = events(messages).find((e) => e.event_type === 'level_end') as Json;
    expect(typeof (levelEnd.data as Json).duration_ms).toBe('number');
    const done = messages.find((m) => m.type === 'luko-game-complete') as Message;
    expect(done.summary?.sessionId).toBe(levelEnd.session_id);
    expect(done.summary?.schema).toBe(3);
  });

  it('?debug=1 رویدادِ ناقص را برای تیمِ بازی‌سازی هشدار می‌دهد', () => {
    const { LUKO, logs } = runSdk('?debug=1');
    LUKO.answer({ correct: 'false', errorType: 'lazy' });
    const warns = logs.filter((line) => line.startsWith('WARN')).join('\n');
    expect(warns).toContain('concept_tag خالی است');
    expect(warns).toContain('correct باید true یا false باشد');
    expect(warns).toContain('errorType یکی از این‌هاست');
    expect(warns).toContain('شماره‌ی تلاش معلوم نیست');
  });

  it('بی‌debug هشداری نیست، و نوعِ خطای نامعتبر فرستاده نمی‌شود', () => {
    const { LUKO, messages, logs } = runSdk();
    LUKO.answer({ concept: 'count', correct: false, errorType: 'lazy' });
    expect(logs).toEqual([]);
    const answer = events(messages).find((e) => e.event_type === 'answer') as Json;
    expect((answer.data as Json).error_type).toBeUndefined();
  });
});
