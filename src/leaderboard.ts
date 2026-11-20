// Ticket-04 local leaderboard rules. Plain erasable TypeScript: imported by the game (Vite) and by scripts/server.mjs (Node type stripping).
export type Entry = { name: string; score: number; nights_won: number; achieved_at: string; seed: number };

export const LB_MAX = 10;
/** 3-12 characters: letters (Vietnamese with diacritics too), digits, underscore. Counted after NFC (assumption D7). */
const NAME = /^[\p{L}\p{M}\p{N}_]+$/u;

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').trim();
  const n = [...s].length;
  return n >= 3 && n <= 12 && NAME.test(s) ? s : null;
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:42:03+07:00. */
export function isoLocal(d: Date): string {
  const p = (x: number, w = 2) => String(Math.abs(x)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** Validates an entry from outside (file, HTTP, localStorage). Returns null when anything is off. */
export function validEntry(e: unknown): Entry | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const name = cleanName(o.name);
  const ok =
    name !== null &&
    Number.isInteger(o.score) && (o.score as number) >= 0 &&
    Number.isInteger(o.nights_won) && (o.nights_won as number) >= 0 && (o.nights_won as number) <= 3 &&
    typeof o.achieved_at === 'string' && /T.*(Z|[+-]\d\d:\d\d)$/.test(o.achieved_at) && !Number.isNaN(Date.parse(o.achieved_at)) &&
    Number.isInteger(o.seed);
  return ok ? { name: name!, score: o.score as number, nights_won: o.nights_won as number, achieved_at: o.achieved_at as string, seed: o.seed as number } : null;
}

/** Score descending; equal score -> earlier achieved_at first; equal time -> the one already on the board first (stable). Top 10. */
export function addEntry(list: Entry[], e: Entry): Entry[] {
  return [...list, e]
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x.score - a.x.score || Date.parse(a.x.achieved_at) - Date.parse(b.x.achieved_at) || a.i - b.i)
    .slice(0, LB_MAX)
    .map(({ x }) => x);
}

/** Parses a stored board, dropping invalid rows, re-sorted. */
export function loadBoard(text: string | null): Entry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? '{"entries":[]}');
  } catch {
    return [];
  }
  const rows = Array.isArray((raw as { entries?: unknown })?.entries) ? (raw as { entries: unknown[] }).entries : [];
  return rows.map(validEntry).filter((x): x is Entry => x !== null).reduce(addEntry, [] as Entry[]);
}
