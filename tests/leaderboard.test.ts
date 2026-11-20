// Ticket-04 §3: local leaderboard rules (src/leaderboard.ts, shared by the game and scripts/server.mjs).
import { describe, expect, it } from 'vitest';
import { addEntry, cleanName, isoLocal, loadBoard, validEntry, type Entry } from '../src/leaderboard';

const e = (name: string, score: number, at: string, nights_won = 1): Entry => ({ name, score, nights_won, achieved_at: at, seed: 1 });

describe('leaderboard', () => {
  it('name: 3-12 of [A-Za-z0-9_], Vietnamese letters allowed (bonus); no spaces or symbols', () => {
    for (const ok of ['abc', 'A_b_9', 'x'.repeat(12), 'Mây', 'NguyễnVăn_A']) expect(cleanName(ok)).not.toBeNull();
    for (const bad of ['ab', 'x'.repeat(13), 'a b c', 'abc!', 'a-bc', '', 42, null]) expect(cleanName(bad)).toBeNull();
    // counted as characters after NFC, not UTF-16 units or combining marks
    expect(cleanName('Ngô\u0301Ấ')).not.toBeNull();
    expect(cleanName('e\u0301e\u0301')).toBeNull(); // 2 characters
  });

  it('sorts by score descending, then earlier achieved_at first, keeps the top 10', () => {
    let b: Entry[] = [];
    b = addEntry(b, e('late', 100, '2026-11-20T10:00:05+07:00'));
    b = addEntry(b, e('early', 100, '2026-11-20T10:00:01+07:00'));
    b = addEntry(b, e('high', 300, '2026-11-20T11:00:00+07:00'));
    expect(b.map((x) => x.name)).toEqual(['high', 'early', 'late']);
    // the same instant written in another time zone compares as the same moment
    b = addEntry(b, e('utc', 100, '2026-11-20T03:00:00Z')); // = 10:00:00+07:00, before 'early'
    expect(b.map((x) => x.name)).toEqual(['high', 'utc', 'early', 'late']);
    for (let i = 0; i < 10; i++) b = addEntry(b, e(`p${i}x`, 200 + i, '2026-11-20T12:00:00+07:00'));
    expect(b).toHaveLength(10);
    expect(b.map((x) => x.score)).toEqual([300, 209, 208, 207, 206, 205, 204, 203, 202, 201]);
    // a score too low for the board is dropped
    expect(addEntry(b, e('low', 1, '2026-11-20T13:00:00+07:00')).some((x) => x.name === 'low')).toBe(false);
  });

  it('equal score and time: the one already on the board stays above', () => {
    const t = '2026-11-20T10:00:00+07:00';
    expect(addEntry([e('first', 50, t)], e('second', 50, t)).map((x) => x.name)).toEqual(['first', 'second']);
  });

  it('entries need every field; achieved_at must carry a time zone; nights_won 0-3', () => {
    expect(validEntry(e('abc', 10, '2026-11-20T10:00:00+07:00', 3))).not.toBeNull();
    expect(validEntry(e('abc', 10, '2026-11-20T10:00:00', 1))).toBeNull();
    expect(validEntry(e('abc', 10, '2026-11-20T10:00:00Z', 4))).toBeNull();
    expect(validEntry({ ...e('abc', -1, '2026-11-20T10:00:00Z') })).toBeNull();
    expect(validEntry({ name: 'abc', score: 1, nights_won: 0, achieved_at: '2026-11-20T10:00:00Z' })).toBeNull();
  });

  it('isoLocal writes ISO 8601 with an offset that parses back to the same instant', () => {
    const d = new Date(Date.UTC(2026, 10, 20, 9, 30, 15));
    const s = isoLocal(d);
    expect(s).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
    expect(Date.parse(s)).toBe(d.getTime());
  });

  it('loading a stored board drops bad rows and re-sorts; broken JSON gives an empty board', () => {
    const text = JSON.stringify({ entries: [e('low', 1, '2026-11-20T10:00:00Z'), { name: 'x' }, e('top', 9, '2026-11-20T10:00:00Z')] });
    expect(loadBoard(text).map((x) => x.name)).toEqual(['top', 'low']);
    expect(loadBoard('{not json')).toEqual([]);
    expect(loadBoard(null)).toEqual([]);
  });
});
