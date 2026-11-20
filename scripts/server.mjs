// Game server (run_cmd): serves the built game from dist/ and keeps the local leaderboard on disk.
// Usage: npm start                       -> build, then serve on http://localhost:4180 (PORT to change)
//        npm start -- --export-leaderboard out.json   -> write {"entries": [...]} in board order and exit
// Leaderboard file: data/leaderboard.json (LEADERBOARD_FILE to change). Needs Node >= 22.18 (runs src/leaderboard.ts directly).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, isoLocal, loadBoard, validEntry } from '../src/leaderboard.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const boardFile = () => resolve(process.env.LEADERBOARD_FILE ?? join(ROOT, 'data', 'leaderboard.json'));

export const readBoard = () => loadBoard(existsSync(boardFile()) ? readFileSync(boardFile(), 'utf8') : null);
function writeBoard(entries) {
  const f = boardFile();
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f + '.tmp', JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(f + '.tmp', f); // atomic replace: a crash never leaves a half-written board
}

/** Connect-style handler for /api/leaderboard (also used by the Vite dev/preview server). Returns false if not ours. */
export function leaderboardApi(req, res) {
  if (!req.url?.split('?')[0].endsWith('/api/leaderboard')) return false;
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET') return send(200, { entries: readBoard() }), true;
  if (req.method !== 'POST') return send(405, { error: 'GET or POST' }), true;
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    let e;
    try {
      const o = JSON.parse(body);
      e = validEntry({ name: o.name, score: o.score, nights_won: o.nights_won, seed: o.seed, achieved_at: isoLocal(new Date()) });
    } catch {}
    if (!e) return send(400, { error: 'name: 3-12 letters, digits or _; score >= 0; nights_won 0-3; integer seed' });
    const entries = addEntry(readBoard(), e);
    writeBoard(entries);
    send(200, { entries, entry: e, rank: entries.indexOf(e) + 1 });
  });
  return true;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
export function startServer(port = Number(process.env.PORT ?? 4180)) {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ not built: run `npm run build` (npm start does it for you)');
  const server = createServer((req, res) => {
    if (leaderboardApi(req, res)) return;
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
    const file = resolve(DIST, path || 'index.html');
    if (!(file + sep).startsWith(DIST + sep) && file !== DIST) return res.writeHead(403).end();
    const f = existsSync(file) && !file.endsWith(sep) && extname(file) ? file : join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise((ok, fail) => server.once('error', fail).listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const i = process.argv.indexOf('--export-leaderboard');
  if (i >= 0) {
    const out = process.argv[i + 1];
    if (!out) (console.error('usage: --export-leaderboard <out.json>'), process.exit(1));
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + '\n');
    console.log(`leaderboard -> ${out}`);
  } else {
    const server = await startServer();
    const url = `http://localhost:${server.address().port}/`;
    console.log(`Đảo Đèn Lồng: ${url}  (Ctrl+C để dừng)`);
    if (!process.argv.includes('--no-open')) {
      const { spawn } = await import('node:child_process');
      const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
      spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    }
  }
}
