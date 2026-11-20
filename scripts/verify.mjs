// One-command verification: unit tests + every headless scenario run twice (determinism) + save proof.
// Usage: npm run verify -- [phase-N]     (proof goes to docs/proof/<phase>/, default "latest")
// Scenario case file: tests/scenarios/<name>.case.json = { "args": ["--seed","1","--night","1","--ticks","600", ...] }
// Paths inside args are relative to the repo root. "--out" is added by this script.
// Optional "expect": { "events": {name: count}, "end": {...}, "last": {...} } checked against the output
// ("end" = end line, "last" = last snapshot; partial deep match).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const phase = process.argv[2] ?? 'latest';
const proofDir = join('docs', 'proof', phase);
const runDir = join('out', 'verify');
mkdirSync(proofDir, { recursive: true });
mkdirSync(runDir, { recursive: true });
const isWin = process.platform === 'win32';
const report = [];

const unit = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8', shell: isWin });
writeFileSync(join(proofDir, 'unit-tests.txt'), (unit.stdout ?? '') + (unit.stderr ?? ''));
report.push(`unit tests: ${unit.status === 0 ? 'PASS' : 'FAIL'}`);

const scenDir = join('tests', 'scenarios');
const cases = existsSync(scenDir) ? readdirSync(scenDir).filter((f) => f.endsWith('.case.json')) : [];
let failed = unit.status !== 0;
for (const f of cases) {
  const name = f.replace('.case.json', '');
  const { args, expect_exit = 0, expect } = JSON.parse(readFileSync(join(scenDir, f), 'utf8'));
  const outs = [1, 2].map((n) => {
    const out = join(runDir, `${name}.${n}.jsonl`);
    const r = spawnSync('npx', ['tsx', 'src/headless/cli.ts', ...args, '--out', out], { encoding: 'utf8', shell: isWin });
    return { out, status: r.status, stderr: r.stderr };
  });
  const exitOk = outs.every((o) => o.status === expect_exit);
  let same = true;
  if (expect_exit === 0) {
    same = readFileSync(outs[0].out, 'utf8') === readFileSync(outs[1].out, 'utf8');
    writeFileSync(join(proofDir, `${name}.jsonl`), readFileSync(outs[0].out));
  }
  const why = expect_exit === 0 && expect ? check(readFileSync(outs[0].out, 'utf8'), expect) : [];
  const ok = exitOk && same && why.length === 0;
  failed ||= !ok;
  report.push(`${name}: exit=${outs[0].status} (want ${expect_exit}) deterministic=${same}${expect ? ` expect=${why.length ? why.join('; ') : 'ok'}` : ''} -> ${ok ? 'PASS' : 'FAIL'}`);
}

function match(got, want, path, out) {
  if (want !== null && typeof want === 'object') {
    for (const k of Object.keys(want)) match(got?.[k], want[k], `${path}.${k}`, out);
  } else if (got !== want) out.push(`${path}=${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
function check(text, exp) {
  const lines = text.trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const out = [];
  for (const [name, n] of Object.entries(exp.events ?? {})) {
    const got = lines.filter((l) => l.type === 'event' && l.name === name).length;
    if (got !== n) out.push(`events.${name}=${got} want ${n}`);
  }
  if (exp.end) match(lines.at(-1), exp.end, 'end', out);
  if (exp.last) match(lines.filter((l) => l.type === 'snapshot').at(-1), exp.last, 'last', out);
  return out;
}

let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
const summary = [`verify @ ${commit} (${new Date().toISOString()})`, ...report, failed ? 'RESULT: FAIL' : 'RESULT: PASS'].join('\n');
writeFileSync(join(proofDir, 'verify-summary.txt'), summary + '\n');
console.log(summary);
process.exit(failed ? 1 : 0);
