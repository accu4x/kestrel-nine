// Leak check: node artifact/test/leak.test.cjs            (every file git would publish)
//             node artifact/test/leak.test.cjs --dir <d>  (a build output, plus problem names)
//
// Fails closed. Run it before every push (OPEN-ITEMS item 30).
//
// The private phrases live outside the repo in ../private/*-denylist.txt and never enter it.
// Findings name the file and line only: nothing here prints the matched text, so a report
// can be pasted anywhere without leaking what it was looking for.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const PRIVATE = path.resolve(REPO, '..', 'private');
const LISTS = ['kestrel-nine-denylist.txt', 'employer-denylist.txt'];
const REQUIRED = LISTS[0];
const SKIP = /\.(png|jpe?g|gif|ico|webp|avif|woff2?|ttf|zip|pdf)$/i;

// Credentials of the kinds this workspace touches. A match is never a false alarm worth keeping.
const SECRETS = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /sk-[A-Za-z0-9]{32,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /(?:CLOUDFLARE|CF)_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/i,
];

// In-game text never names the problem behind a job (CLAUDE.md). Design notes in the repo may,
// so this list applies only to --dir scans of what ships to players.
const PROBLEM_NAMES = [
  /(?<![A-Za-z0-9])NP(?![A-Za-z0-9])/,
  /travell?ing salesm[ae]n/i,
  /vertex cover/i,
  /max(?:imum)?[ -]coverage/i,
  /set cover/i,
  /MAX-?2-?SAT/i,
  /(?<![A-Za-z0-9])TSP(?![A-Za-z0-9])/,
  /knapsack/i,
  /NP-(?:hard|complete)/i,
];

// Same rules as latent-mirror's private-scan: a single word is case-sensitive whole-word; a
// phrase is case-insensitive with its spacing loosened, so a line wrap cannot hide it.
const toMatcher = (term) => {
  const body = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, /\s/.test(term) ? 'i' : '');
};
const parse = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(toMatcher);

const denylist = [];
for (const name of LISTS) {
  const file = path.join(PRIVATE, name);
  if (fs.existsSync(file)) denylist.push(...parse(fs.readFileSync(file, 'utf8')));
  else if (name === REQUIRED && !process.env.CI) {
    console.error(`leak: ../private/${name} is missing, so nothing is vouched for. Failing closed.`);
    process.exit(1);
  }
}

const dirArg = process.argv.indexOf('--dir');
const dir = dirArg > 0 ? path.resolve(process.argv[dirArg + 1] || '') : null;

const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(root, d.name)) : [path.join(root, d.name)]);

// Tracked plus untracked-but-not-ignored: exactly what `git add -A` would publish.
const files = dir
  ? walk(dir)
  : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8' })
      .split('\n').filter(Boolean).map((f) => path.join(REPO, f));

const checks = [['private phrase', denylist], ['secret', SECRETS]];
if (dir) checks.push(['problem name', PROBLEM_NAMES]);

let bad = 0;
let unreadable = 0;
let scanned = 0;
for (const file of files) {
  if (SKIP.test(file)) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT' && !dir) continue; // deleted in the working tree: nothing to publish
    console.error('UNREADABLE', path.relative(REPO, file)); unreadable++; continue;
  }
  scanned++;
  text.split('\n').forEach((line, i) => {
    for (const [kind, res] of checks) {
      if (res.some((re) => re.test(line))) { console.error(`FAIL ${kind}: ${path.relative(REPO, file)}:${i + 1}`); bad++; }
    }
  });
  // Phrases wrapped across lines: check the whole file too, reporting the file only.
  if (denylist.some((re) => re.test(text)) && !text.split('\n').some((l) => denylist.some((re) => re.test(l)))) {
    console.error(`FAIL private phrase (across lines): ${path.relative(REPO, file)}`); bad++;
  }
}

if (bad || unreadable) {
  console.error(`leak: ${bad} finding(s), ${unreadable} unreadable. Matched text is never printed; open the line.`);
  process.exit(1);
}
console.log(`leak: clean. ${scanned} files, ${denylist.length} private phrases, ${SECRETS.length} secret patterns` +
  (dir ? `, ${PROBLEM_NAMES.length} problem names` : '') + '.');
