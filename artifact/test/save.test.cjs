// Node test: node artifact/test/save.test.cjs
// Save files (OPEN-ITEMS item 27): a valid save round-trips; every rule rejects a bad file.
const fs = require('node:fs');
const path = require('node:path');
const S = require('../src/save.js');
const E = require('../src/engine.js');
const C = require('../src/content.js');

let failed = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); failed++; process.exitCode = 1; } };
// Mirrors saveSchema() in game.js, which rebuilds titles from the game's own specs.
const label = (t) => C.TYPE_INFO[t].label.toLowerCase();
const schema = {
  campaigns: Object.fromEntries(C.CAMPAIGN.map((c) => [c.id, c.type])),
  typeDirs: Object.fromEntries(Object.keys(E.TYPES).map((t) => [t, E.TYPES[t].dir])),
  modules: Object.fromEntries(Object.keys(E.MODULES).map((id) => [id, E.MODULES[id].job])), slots: E.SLOTS,
  titleOf(kind, type, seedKey) {
    if (kind === 'campaign') return C.CAMPAIGN.find((c) => c.id === seedKey).title;
    if (kind === 'daily') return 'Daily ' + label(type);
    return 'Arcade ' + label(type) + ' ' + seedKey.split('-')[2] + (seedKey.includes('+') ? ' · refit' : '');
  },
};
const NOW = Date.UTC(2026, 8, 28, 12);
const run = (o) => Object.assign({
  seedKey: 'c1', kind: 'campaign', type: 'haul', title: 'Cold Start', day: '2026-09-28', dir: 'min',
  machine: 812.4, solo: 790.1, centaur: 760.3, best: 760.3, bestProven: true,
  machinePct: 93.6, soloPct: 96.2, centaurPct: 100, bestPct: 100,
  centaurWin: true, polishes: 2, advisoriesUsed: 1, ts: NOW - 3600e3,
}, o);
const prog = {
  done: { c1: { bestPct: 100, outcome: 'optimal' }, c2: { bestPct: 91.2, outcome: 'beat' } },
  rep: { aug: 2, con: -1, inq: 0, union: 3 },
  runs: [
    run(),
    run({ seedKey: 'd-2026-09-28-survey', kind: 'daily', type: 'survey', title: 'Daily survey', dir: 'max', solo: null, soloPct: null }),
    run({ seedKey: 'a-treaty-M-7F3A', kind: 'arcade', type: 'treaty', title: 'Arcade treaty M', dir: 'max' }),
    run({ seedKey: 'a-engagement-L-K9', kind: 'arcade', type: 'engagement', title: 'Arcade engagement L', dir: 'max', machine: 41, solo: 38, centaur: 44, best: 44 }),
    run({ seedKey: 'a-survey-M-7F3A+light.overlap.second', kind: 'arcade', type: 'survey', title: 'Arcade survey M · refit', dir: 'max', advisoriesUsed: 4 }),
  ],
};
const good = () => JSON.parse(JSON.stringify(S.exportSave(prog, new Date(NOW))));
const parse = (obj) => S.parseSave(typeof obj === 'string' ? obj : JSON.stringify(obj), schema, NOW);
const rejects = (name, mutate) => {
  const d = good(); const text = mutate(d);
  const r = parse(text === undefined ? d : text);
  assert(!r.ok && typeof r.error === 'string', 'should reject: ' + name);
};

// Round trip (titles are left out of the file and rebuilt on import)
assert(good().progress.runs.every((r) => !('title' in r)), 'export carries no free text: run titles are left out');
const back = parse(good());
assert(back.ok, 'valid save should parse: ' + back.error);
assert(back.ok && JSON.stringify(back.progress) === JSON.stringify(prog), 'round trip should restore progress exactly');
assert(good().app === 'kestrel-nine' && good().v === 1 && good().exported === new Date(NOW).toISOString(), 'export header');

// The prologue flag (item 35): optional boolean, carried both ways
assert(!('prologue' in good().progress) && !('prologue' in back.progress), 'no prologue key: older saves keep their shape and still parse');
const seen = S.exportSave(Object.assign({}, prog, { prologue: true }), new Date(NOW));
const sr = parse(seen);
assert(seen.progress.prologue === true && sr.ok && sr.progress.prologue === true, 'prologue: true round-trips');
const unseen = good(); unseen.progress.prologue = false;
const ur = parse(unseen);
assert(ur.ok && ur.progress.prologue === false, 'prologue: false is accepted');
rejects('prologue as a string', (d) => { d.progress.prologue = 'true'; });
rejects('prologue as a number', (d) => { d.progress.prologue = 1; });
rejects('prologue as null', (d) => { d.progress.prologue = null; });

// Header rules
rejects('not JSON', () => '{ nope');
rejects('array root', () => '[]');
rejects('wrong app', (d) => { d.app = 'another-game'; });
rejects('wrong version', (d) => { d.v = 2; });
rejects('extra top-level key', (d) => { d.settings = { sound: false }; });
rejects('__proto__ key', () => '{"app":"kestrel-nine","v":1,"progress":{},"__proto__":{"x":1}}');
rejects('extra progress key', (d) => { d.progress.callsign = 'HIJACK'; });
rejects('bad export date', (d) => { d.exported = 'x'.repeat(41); });
rejects('oversized file', (d) => JSON.stringify(d) + ' '.repeat(S.MAX_BYTES));

// done
rejects('unknown mission id', (d) => { d.progress.done.c99 = { bestPct: 50, outcome: 'beat' }; });
rejects('done outcome not known', (d) => { d.progress.done.c1.outcome = 'won'; });
rejects('done pct out of range', (d) => { d.progress.done.c1.bestPct = 101; });

// rep
rejects('rep above range', (d) => { d.progress.rep.aug = 51; });
rejects('rep below range', (d) => { d.progress.rep.inq = -51; });
rejects('rep not an integer', (d) => { d.progress.rep.con = 1.5; });
rejects('rep as a string', (d) => { d.progress.rep.con = '3'; });
rejects('unknown rep key', (d) => { d.progress.rep.guild = 1; });
const edge = good(); edge.progress.rep = { aug: 50, con: -50 };
const er = parse(edge);
assert(er.ok && er.progress.rep.aug === 50 && er.progress.rep.con === -50 && er.progress.rep.union === 0, 'rep edges accepted, missing keys default to 0');

// runs
rejects('too many runs', (d) => { d.progress.runs = Array.from({ length: S.MAX_RUNS + 1 }, () => run()); });
rejects('runs not an array', (d) => { d.progress.runs = {}; });
rejects('run pct out of range', (d) => { d.progress.runs[0].centaurPct = 250; });
rejects('run value negative', (d) => { d.progress.runs[0].machine = -1; });
rejects('run value not finite', () => JSON.stringify(good()).replace('"machine":812.4', '"machine":1e999'));
rejects('run unknown kind', (d) => { d.progress.runs[0].kind = 'rumor'; });
rejects('run dir disagrees with type', (d) => { d.progress.runs[0].dir = 'max'; });
rejects('run seedKey for an unknown mission', (d) => { d.progress.runs[0].seedKey = 'c99'; });
rejects('run arcade seedKey malformed', (d) => { d.progress.runs[2].seedKey = 'a-treaty-M-<b>'; });
rejects('run advisories out of range', (d) => { d.progress.runs[0].advisoriesUsed = 4; });
rejects('run from the future', (d) => { d.progress.runs[0].ts = NOW + 30 * 86400e3; });
rejects('daily key names another job', (d) => { d.progress.runs[1].seedKey = 'd-2026-09-28-treaty'; });
rejects('arcade key names another job', (d) => { d.progress.runs[2].type = 'survey'; });
rejects('engagement record scored the wrong way round', (d) => { d.progress.runs[3].dir = 'min'; });

// Refit runs (item 32): the key ends in the loadout, and only a known, fitting, sorted one passes
rejects('loadout names an unknown module', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+light.turbo'; });
rejects('loadout module belongs to another job', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+light.tongue'; });
rejects('loadout out of order', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+overlap.light'; });
rejects('loadout repeats a module', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+light.light'; });
rejects('loadout larger than the ship carries', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+deep.light.overlap.second'; d.progress.runs[4].advisoriesUsed = 1; });
rejects('loadout with markup in it', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+<b>'; });
rejects('a fourth advisory without the module for it', (d) => { d.progress.runs[4].seedKey = 'a-survey-M-7F3A+light.overlap'; });
rejects('a loadout on a daily run', (d) => { d.progress.runs[1].seedKey = 'd-2026-09-28-survey+light'; });
rejects('campaign key belongs to another job', (d) => { d.progress.runs[0].seedKey = 'c2'; });
rejects('prototype key as a type', (d) => { d.progress.runs[0].type = 'constructor'; });
rejects('run missing a field', (d) => { delete d.progress.runs[0].best; });

// Unknown fields inside a run are dropped, not trusted
const extra = good(); extra.progress.runs[0].html = '<script>alert(1)</script>'; extra.progress.runs[0].uid = 'someone';
const xr = parse(extra);
assert(xr.ok && !('html' in xr.progress.runs[0]) && !('uid' in xr.progress.runs[0]), 'unknown run fields are dropped');

// HTML in a title field stays inert: the file's title is ignored and rebuilt from IDs, and the
// game shell has no way to render a string as markup.
const html = good(); html.progress.runs[0].title = '<img src=x onerror=alert(1)>';
const hr = parse(html);
assert(hr.ok && hr.progress.runs[0].title === 'Cold Start', 'a title in the file is ignored and rebuilt');
const game = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
assert(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser|createContextualFragment/.test(game), 'game.js must never parse strings as HTML');

// Import never touches settings or callsign: the parsed result carries progress only.
assert(back.ok && Object.keys(back).sort().join() === 'ok,progress' && Object.keys(back.progress).sort().join() === 'done,rep,runs', 'result shape is progress only');
assert(sr.ok && Object.keys(sr.progress).sort().join() === 'done,prologue,rep,runs', 'result shape with the prologue flag');

console.log(failed ? `save: ${failed} failure(s)` : 'save: all checks passed');
