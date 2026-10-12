import { describe, expect, it } from 'vitest';
import { chunkEvents, toApiEvents } from '../telemetry';
import type { GameEventPayload } from '../telemetry';

const v3Answer = {
  schema_version: 3,
  event_id: '9f1c2e0a-4b7d-4c1e-8a52-3d6f0b9e7a14',
  session_id: 's-abc',
  event_type: 'answer',
  concept_tag: 'addition_2digit',
  timestamp: 1760265000123,
  level: 2,
  data: {
    is_correct: false, time_taken_ms: 4500, attempt_number: 2, error_type: 'conceptual',
    hint_used: false, question_id: 'q7', given: '35', expected: '53', status: 'PLAYING',
  },
};

describe('toApiEvents — پیامِ بازی ← شکلِ API', () => {
  it('رویدادِ نسخه‌ی ۳: ستون‌های استاندارد جدا، بقیه payload', () => {
    const [item] = toApiEvents('g-1a2b', { type: 'luko-game-event', sessionId: 's-abc', event: v3Answer });
    expect(item).toEqual({
      gameSlug: 'g-1a2b', eventType: 'answer', schemaVersion: 3,
      eventId: '9f1c2e0a-4b7d-4c1e-8a52-3d6f0b9e7a14', sessionId: 's-abc', occurredAt: 1760265000123,
      conceptTag: 'addition_2digit', level: 2, isCorrect: false, timeTakenMs: 4500, attemptNumber: 2,
      errorType: 'conceptual', hintUsed: false, durationMs: undefined,
      payload: { question_id: 'q7', given: '35', expected: '53', status: 'PLAYING' },
    });
  });

  it('شناسه‌ی بازی همیشه از صفحه می‌آید، نه از خودِ بازی', () => {
    const [item] = toApiEvents('g-real', {
      type: 'luko-game-event', game: 'g-fake', event: { ...v3Answer, data: { ...v3Answer.data, game_id: 'g-fake' } },
    });
    expect(item.gameSlug).toBe('g-real');
  });

  it('رویدادِ نسخه‌ی ۲ (SDKِ کش‌شده) همان‌طور می‌رود و سرور خودش می‌فهمد', () => {
    const [item] = toApiEvents('g-1', {
      type: 'luko-game-event', sessionId: 's-old',
      event: { type: 'answer', at: '2026-10-12T10:00:00.000Z', topic: 'count', correct: true, ms: 2000 },
    });
    expect(item).toEqual({
      gameSlug: 'g-1', eventType: 'answer', sessionId: 's-old',
      payload: { at: '2026-10-12T10:00:00.000Z', topic: 'count', correct: true, ms: 2000 },
    });
  });

  it('خلاصه‌ی جلسه زمانِ فعال را می‌برد (نه با مکث) و جلسه‌اش را', () => {
    const summary = { sessionId: 's-9', durationMs: 900_000, activeMs: 600_000, accuracy: 80 };
    const [done] = toApiEvents('g-1', { type: 'luko-game-complete', summary });
    expect(done).toMatchObject({ eventType: 'game_complete', sessionId: 's-9', durationMs: 600_000, payload: summary });
    const [left] = toApiEvents('g-1', { type: 'luko-game-progress', summary: { durationMs: 1000 } });
    expect(left).toMatchObject({ eventType: 'game_end', durationMs: 1000 });
  });

  it('پیامِ ناشناخته یا خراب چیزی نمی‌سازد', () => {
    expect(toApiEvents('g-1', null)).toEqual([]);
    expect(toApiEvents('g-1', { type: 'luko-coins', coins: 5 })).toEqual([]);
    expect(toApiEvents('g-1', { type: 'luko-game-event', event: { schema_version: 3 } })).toEqual([]);
    expect(toApiEvents('g-1', { type: 'luko-game-event', event: 'x' })).toEqual([]);
  });
});

describe('chunkEvents — دسته‌های ارسال', () => {
  const make = (n: number, pad = 0): GameEventPayload[] =>
    Array.from({ length: n }, (_, i) => ({ gameSlug: 'g', eventType: 'answer', payload: { i, pad: 'x'.repeat(pad) } }));

  it('هر درخواست حداکثر ۱۰۰ رویداد (سرور تا ۲۰۰ می‌پذیرد)', () => {
    const chunks = chunkEvents(make(250));
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunks.flat()).toHaveLength(250);
  });

  it('keepalive: هر دسته زیرِ سقفِ بایت', () => {
    const chunks = chunkEvents(make(40, 3000), 56_000);
    for (const chunk of chunks) expect(JSON.stringify(chunk).length).toBeLessThanOrEqual(56_000);
    expect(chunks.flat()).toHaveLength(40);
  });

  it('رویدادِ تکیِ بزرگ هم گم نمی‌شود', () => {
    const chunks = chunkEvents(make(1, 80_000), 56_000);
    expect(chunks).toHaveLength(1);
  });
});
