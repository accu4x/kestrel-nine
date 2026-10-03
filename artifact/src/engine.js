/* Kestrel Nine: puzzle engine.
 * Deterministic generators, NAV-7's one-pass procedures, polish (local search),
 * advisories, and the archive's charted best (exact where tractable).
 * Runs in the browser (window.K9Engine) and in Node (module.exports) for tests.
 */
(function (root) {
  'use strict';

  // ---------- seeded randomness ----------
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function makeRng(seedStr) {
    let a = hashSeed(String(seedStr));
    const next = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    next.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return next;
  }

  const W = 1000, H = 625, M = 70;
  const BIRDS = ['Tern', 'Merlin', 'Gannet', 'Shrike', 'Wren', 'Heron', 'Petrel', 'Osprey',
    'Harrier', 'Plover', 'Curlew', 'Swift', 'Lark', 'Rook', 'Finch', 'Egret', 'Kite', 'Martin',
    'Dunlin', 'Sparrow', 'Avocet', 'Linnet', 'Siskin', 'Crake', 'Godwit', 'Pipit', 'Whimbrel',
    'Bittern', 'Dipper', 'Fulmar'];

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function placePoints(rng, n, minD, box) {
    const b = box || { x0: M, y0: M, x1: W - M, y1: H - M };
    const pts = [];
    let tries = 0, d = minD;
    while (pts.length < n) {
      const p = { x: b.x0 + rng() * (b.x1 - b.x0), y: b.y0 + rng() * (b.y1 - b.y0) };
      if (pts.every((q) => dist(p, q) >= d)) pts.push(p);
      if (++tries > 4000) { d *= 0.9; tries = 0; }
    }
    return pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  }

  // length of segment AB inside circle C
  function chordInside(a, b, c) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const fx = a.x - c.x, fy = a.y - c.y;
    const A = dx * dx + dy * dy;
    if (A === 0) return 0;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - c.r * c.r;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return 0;
    const s = Math.sqrt(disc);
    let t1 = (-B - s) / (2 * A), t2 = (-B + s) / (2 * A);
    t1 = Math.max(0, t1); t2 = Math.min(1, t2);
    if (t2 <= t1) return 0;
    return (t2 - t1) * Math.sqrt(A);
  }

  const round1 = (x) => Math.round(x * 10) / 10;

  // Ship modules (OPEN-ITEMS item 32). A module changes a rule, and it is declared by what that
  // costs the solvers: 'map' edits the generated map, so every solver runs unchanged; 'score'
  // changes how a plan is scored, on a job whose charted best tries every plan anyway; 'engine'
  // changes the partnership (advisories, polish) and leaves the puzzle alone. NAV-7, polish and
  // the charted best always play under the pilot's modules. Names and rule text are in content.js.
  const MODULES = {
    ghost: { job: 'haul', kind: 'map' },        // sensor bubbles cost less
    light: { job: 'survey', kind: 'map' },      // every rig costs 1 less
    overlap: { job: 'survey', kind: 'score' },  // ore reached twice pays half again
    wideband: { job: 'blockade', kind: 'map' }, // jammers at hubs cost 1 less
    tongue: { job: 'treaty', kind: 'score' },   // the heaviest unmet demand counts as met
    aft: { job: 'engagement', kind: 'map' },    // the aft arc blocks double
    second: { job: 'all', kind: 'engine' },     // a fourth advisory
    deep: { job: 'all', kind: 'engine' },       // polish looks two changes ahead
  };
  const SLOTS = 3; // the Second Wind carries three
  const fitted = (o, id) => !!(o && o.mods && o.mods.includes(id));
  const modsOf = (o) => ((o && o.mods) || []).slice();
  function fmtNum(x) { return x.toLocaleString('en-US'); }

  // =====================================================================
  // HAUL: visit every port, return home.
  // =====================================================================
  const Haul = {
    type: 'haul', dir: 'min', unit: 'lh',
    generate(seed, o) {
      const rng = makeRng('haul|' + seed);
      const n = o.n || 8;
      const pts = placePoints(rng, n, o.minD || Math.max(70, 260 - n * 11));
      // home: the point closest to the left-center reads well as a start
      let hi = 0, hb = Infinity;
      pts.forEach((p, i) => { const s = Math.hypot(p.x - 120, p.y - H / 2); if (s < hb) { hb = s; hi = i; } });
      [pts[0], pts[hi]] = [pts[hi], pts[0]];
      const names = (o.names || []).slice();
      const pool = rng.shuffle(BIRDS);
      while (names.length < n) names.push(pool[names.length % pool.length]);
      let hazard = null;
      if (o.hazard) {
        for (let t = 0; t < 200 && !hazard; t++) {
          const c = { x: 330 + rng() * 420, y: 160 + rng() * 300, r: o.hazard.r || 150 };
          if (dist(c, pts[0]) > c.r + 50) hazard = c;
        }
        hazard.mult = o.hazard.mult || 2.4;
        hazard.label = o.hazard.label || 'SENSOR BUBBLE';
        if (fitted(o, 'ghost')) hazard.mult = Math.min(hazard.mult, 1.5);
      }
      const D = [];
      for (let i = 0; i < n; i++) {
        D.push([]);
        for (let j = 0; j < n; j++) {
          if (i === j) { D[i].push(0); continue; }
          let d = dist(pts[i], pts[j]);
          if (hazard) d += chordInside(pts[i], pts[j], hazard) * (hazard.mult - 1);
          D[i].push(d / 100);
        }
      }
      return { type: 'haul', seed, n, pts, names, hazard, D, mods: modsOf(o) };
    },
    empty() { return [0]; },
    complete(p, s) { return s.length === p.n; },
    evaluate(p, s) {
      if (!Array.isArray(s) || s[0] !== 0) return { valid: false, value: 0, note: 'Route must start at home.' };
      let v = 0;
      for (let i = 1; i < s.length; i++) v += p.D[s[i - 1]][s[i]];
      const complete = s.length === p.n && new Set(s).size === p.n;
      if (complete) v += p.D[s[s.length - 1]][0];
      return { valid: complete, value: v, note: complete ? '' : (p.n - s.length) + ' ports left' };
    },
    cost(p, s) {
      let v = 0;
      for (let i = 0; i < s.length; i++) v += p.D[s[i]][s[(i + 1) % s.length]];
      return v;
    },
    nnFrom(p, path) {
      const s = path.slice(), used = new Set(s);
      let work = 0;
      while (s.length < p.n) {
        const last = s[s.length - 1];
        let best = -1, bd = Infinity;
        for (let j = 0; j < p.n; j++) {
          if (used.has(j)) continue;
          work++;
          if (p.D[last][j] < bd) { bd = p.D[last][j]; best = j; }
        }
        s.push(best); used.add(best);
      }
      return { s, work };
    },
    machine(p) {
      const r = Haul.nnFrom(p, [0]);
      return { solution: r.s, work: r.work, procedure: 'Nearest-first: from each port, fly to the closest unvisited port.' };
    },
    twoOpt(p, t) {
      const n = t.length, D = p.D;
      let improved = true, passes = 0;
      while (improved && passes < 200) {
        improved = false; passes++;
        for (let i = 1; i < n - 1; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = t[i - 1], b = t[i], c = t[j], d = t[(j + 1) % n];
            const delta = D[a][c] + D[b][d] - D[a][b] - D[c][d];
            if (delta < -1e-9) {
              for (let x = i, y = j; x < y; x++, y--) { const tmp = t[x]; t[x] = t[y]; t[y] = tmp; }
              improved = true;
            }
          }
        }
      }
      return t;
    },
    orOpt(p, t) {
      const n = t.length;
      let improved = true, guard = 0, any = false;
      while (improved && guard++ < 200) {
        improved = false;
        let base = Haul.cost(p, t);
        outer:
        for (let len = 1; len <= 3; len++) {
          for (let i = 1; i + len <= n; i++) {
            const seg = t.slice(i, i + len);
            const rest = t.slice(0, i).concat(t.slice(i + len));
            for (let k = 0; k < rest.length; k++) {
              for (const rev of [false, true]) {
                const s2 = rev ? seg.slice().reverse() : seg;
                const cand = rest.slice(0, k + 1).concat(s2, rest.slice(k + 1));
                if (cand[0] !== 0) continue;
                const c = Haul.cost(p, cand);
                if (c < base - 1e-9) {
                  for (let z = 0; z < n; z++) t[z] = cand[z];
                  base = c; improved = true; any = true;
                  break outer;
                }
              }
            }
          }
        }
      }
      return any;
    },
    polish(p, s) {
      if (!Haul.complete(p, s)) return { ok: false, reason: 'Plan incomplete. This engine may refine a finished route, not originate one.' };
      const t = s.slice();
      for (let k = 0; k < 20; k++) {
        const before = Haul.cost(p, t);
        Haul.twoOpt(p, t); Haul.orOpt(p, t);
        if (Haul.cost(p, t) >= before - 1e-9) break;
      }
      return { ok: true, solution: t };
    },
    // Advisory: the next port, chosen by one-step lookahead with a nearest-first rollout.
    suggest(p, s) {
      if (Haul.complete(p, s)) {
        const r = Haul.polish(p, s);
        if (Haul.cost(p, r.solution) < Haul.cost(p, s) - 1e-9) return { kind: 'polish', text: 'A polish pass would shorten this route.' };
        return { kind: 'none', text: 'No single improvement found. This route is locally sound.' };
      }
      const used = new Set(s);
      let best = -1, bv = Infinity;
      for (let c = 0; c < p.n; c++) {
        if (used.has(c)) continue;
        const r = Haul.nnFrom(p, s.concat([c]));
        const v = Haul.cost(p, r.s);
        if (v < bv) { bv = v; best = c; }
      }
      return { kind: 'next', node: best, text: 'Advisory: ' + p.names[best] + ' next.' };
    },
    exact(p) {
      const n = p.n, m = n - 1, D = p.D;
      if (n > 15) return null;
      if (n <= 2) return { solution: [...Array(n).keys()], value: Haul.cost(p, [...Array(n).keys()]), work: 1, proven: true };
      const FULL = 1 << m;
      const dp = new Float64Array(FULL * m).fill(Infinity);
      const par = new Int8Array(FULL * m).fill(-1);
      for (let j = 0; j < m; j++) dp[(1 << j) * m + j] = D[0][j + 1];
      let work = 0;
      for (let mask = 1; mask < FULL; mask++) {
        for (let j = 0; j < m; j++) {
          if (!(mask & (1 << j))) continue;
          const cur = dp[mask * m + j];
          if (cur === Infinity) continue;
          for (let k = 0; k < m; k++) {
            if (mask & (1 << k)) continue;
            work++;
            const nm = mask | (1 << k), v = cur + D[j + 1][k + 1];
            if (v < dp[nm * m + k]) { dp[nm * m + k] = v; par[nm * m + k] = j; }
          }
        }
      }
      let best = Infinity, bj = -1;
      for (let j = 0; j < m; j++) {
        const v = dp[(FULL - 1) * m + j] + D[j + 1][0];
        if (v < best) { best = v; bj = j; }
      }
      const path = [];
      let mask = FULL - 1, j = bj;
      while (j >= 0) { path.push(j + 1); const pj = par[mask * m + j]; mask ^= 1 << j; j = pj; }
      path.push(0); path.reverse();
      return { solution: path, value: best, work, proven: true };
    },
    heuristicBest(p) {
      const rng = makeRng('best|' + p.seed);
      let best = null, bv = Infinity;
      const tryT = (t) => { const r = Haul.polish(p, t).solution; const v = Haul.cost(p, r); if (v < bv) { bv = v; best = r; } };
      for (let s = 1; s < p.n; s++) tryT(Haul.nnFrom(p, [0, s]).s);
      for (let k = 0; k < 40; k++) tryT([0].concat(rng.shuffle([...Array(p.n).keys()].slice(1))));
      return { solution: best, value: bv, work: 0, proven: false };
    },
    charted(p) { return Haul.exact(p) || Haul.heuristicBest(p); },
    // Every finished route one change away: a stretch reversed, or one port moved.
    moves(p, s) {
      const out = [], n = s.length;
      if (!Haul.complete(p, s)) return out;
      for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++) out.push(s.slice(0, i).concat(s.slice(i, j + 1).reverse(), s.slice(j + 1)));
      for (let i = 1; i < n; i++) {
        const rest = s.slice(0, i).concat(s.slice(i + 1));
        for (let k = 1; k <= rest.length; k++) if (k !== i) out.push(rest.slice(0, k).concat([s[i]], rest.slice(k)));
      }
      return out;
    },
    format(v) { return round1(v).toFixed(1) + ' lh'; },
    describe(p, s) {
      return s.map((i) => p.names[i]).concat(Haul.complete(p, s) ? [p.names[0]] : []).join(' > ');
    },
  };

  // =====================================================================
  // SURVEY: place K rigs to cover the richest deposits.
  // =====================================================================
  const ORE = [
    { key: 'iron', label: 'IRON', t: 4 },
    { key: 'cobalt', label: 'COBALT', t: 9 },
    { key: 'lumen', label: 'LUMEN', t: 22 },
  ];
  const RIG = [null, { r: 95, label: 'LIGHT' }, { r: 130, label: 'HEAVY' }, { r: 165, label: 'DEEP' }];
  const Survey = {
    type: 'survey', dir: 'max', unit: 't',
    generate(seed, o) {
      const rng = makeRng('survey|' + seed);
      const m = o.sites || 16, B = o.budget || 6;
      const nd = o.deposits || 48;
      const nc = o.clusters || Math.max(4, Math.round(nd / 9));
      const centers = placePoints(rng, nc, 150, { x0: 110, y0: 100, x1: W - 110, y1: H - 100 });
      const deps = [];
      let guard = 0;
      while (deps.length < nd && guard++ < 10000) {
        const c = rng.pick(centers);
        const x = c.x + rng.gauss() * 55, y = c.y + rng.gauss() * 45;
        if (x < 40 || x > W - 40 || y < 40 || y > H - 40) continue;
        const roll = rng();
        const ore = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
        deps.push({ x: Math.round(x), y: Math.round(y), ore, t: ORE[ore].t });
      }
      // anchor rocks: size sets rig class (reach) and cost in anchor credits
      const sites = [];
      guard = 0;
      while (sites.length < m && guard++ < 20000) {
        let x, y;
        if (rng() < 0.55) {
          const a = rng.pick(centers), b = rng.pick(centers);
          const f = 0.3 + rng() * 0.4;
          x = a.x + (b.x - a.x) * f + rng.gauss() * 30;
          y = a.y + (b.y - a.y) * f + rng.gauss() * 30;
        } else {
          const c = rng.pick(centers);
          x = c.x + rng.gauss() * 90; y = c.y + rng.gauss() * 80;
        }
        if (x < 50 || x > W - 50 || y < 50 || y > H - 50) continue;
        const r = rng();
        const cost = r < 0.45 ? 1 : r < 0.8 ? 2 : 3;
        const pt = { x: Math.round(x), y: Math.round(y), cost, cls: cost, r: RIG[cost].r };
        if (sites.some((s) => dist(s, pt) < 58)) continue;
        sites.push(pt);
      }
      const words = Math.ceil(deps.length / 32);
      const cover = sites.map((s) => {
        const bits = new Uint32Array(words), list = [];
        deps.forEach((d, i) => { if (dist(s, d) <= s.r) { bits[i >> 5] |= 1 << (i & 31); list.push(i); } });
        return { bits, list };
      });
      const names = sites.map((s, i) => 'ROCK ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? '2' : ''));
      // Light Rigs: a rig keeps its class and reach (`cls`) and costs 1 less.
      if (fitted(o, 'light')) for (const site of sites) site.cost = Math.max(1, site.cost - 1);
      return { type: 'survey', seed, m, B, sites, deps, cover, words, names, overlap: fitted(o, 'overlap'), mods: modsOf(o) };
    },
    empty() { return []; },
    spent(p, s) { return s.reduce((a, i) => a + p.sites[i].cost, 0); },
    complete(p, s) { return s.length > 0 && Survey.spent(p, s) <= p.B; },
    // Ore counts once. With Overlap Refinery, ore that two or more rigs reach pays half again.
    yieldOf(p, acc, twice) {
      let v = 0;
      for (let i = 0; i < p.deps.length; i++) {
        const w = i >> 5, bit = 1 << (i & 31);
        if (acc[w] & bit) v += p.deps[i].t * (p.overlap && (twice[w] & bit) ? 1.5 : 1);
      }
      return v;
    },
    value(p, s) {
      const acc = new Uint32Array(p.words), twice = new Uint32Array(p.words);
      for (const i of s) { const b = p.cover[i].bits; for (let w = 0; w < p.words; w++) { twice[w] |= acc[w] & b[w]; acc[w] |= b[w]; } }
      return Survey.yieldOf(p, acc, twice);
    },
    evaluate(p, s) {
      const v = Survey.value(p, s), sp = Survey.spent(p, s);
      const ok = s.length > 0 && sp <= p.B && new Set(s).size === s.length;
      return { valid: ok, value: v, note: sp > p.B ? 'Over budget by ' + (sp - p.B) : s.length ? '' : 'No rigs placed' };
    },
    bestRatio(p, s) {
      const base = Survey.value(p, s), left = p.B - Survey.spent(p, s);
      let best = -1, br = 0, bg = 0;
      for (let j = 0; j < p.m; j++) {
        if (s.includes(j) || p.sites[j].cost > left) continue;
        const g = Survey.value(p, s.concat([j])) - base;
        const r = g / p.sites[j].cost;
        if (g > 0 && r > br) { br = r; best = j; bg = g; }
      }
      return { j: best, gain: bg };
    },
    machine(p) {
      const s = [];
      let work = 0;
      for (;;) { const r = Survey.bestRatio(p, s); work += p.m; if (r.j < 0) break; s.push(r.j); }
      return { solution: s, work, procedure: 'Best yield per credit: place each rig where it adds the most new ore per anchor credit, until no rig fits.' };
    },
    polish(p, s) {
      if (!Survey.complete(p, s)) return { ok: false, reason: 'Plan not valid yet. Place rigs within budget, then this engine may refine the layout.' };
      let t = s.slice();
      for (let guard = 0; guard < 200; guard++) {
        const base = Survey.value(p, t), sp = Survey.spent(p, t);
        let best = null, bv = base;
        // add
        for (let j = 0; j < p.m; j++) {
          if (t.includes(j) || sp + p.sites[j].cost > p.B) continue;
          const v = Survey.value(p, t.concat([j]));
          if (v > bv) { bv = v; best = t.concat([j]); }
        }
        // swap one for one
        for (let i = 0; i < t.length; i++) {
          for (let j = 0; j < p.m; j++) {
            if (t.includes(j) || sp - p.sites[t[i]].cost + p.sites[j].cost > p.B) continue;
            const c = t.slice(); c[i] = j;
            const v = Survey.value(p, c);
            if (v > bv) { bv = v; best = c; }
          }
        }
        if (!best) break;
        t = best;
      }
      return { ok: true, solution: t };
    },
    suggest(p, s) {
      const r = Survey.bestRatio(p, s);
      if (r.j >= 0) return { kind: 'next', node: r.j, text: 'Advisory: rig ' + p.names[r.j] + ' (+' + Survey.format(r.gain) + ').' };
      if (Survey.complete(p, s)) {
        const po = Survey.polish(p, s);
        if (Survey.value(p, po.solution) > Survey.value(p, s)) return { kind: 'polish', text: 'A polish pass would raise the yield.' };
      }
      return { kind: 'none', text: 'No affordable rig adds ore.' };
    },
    exact(p) {
      // order sites by cost-efficiency so good solutions come early
      const m = p.m;
      let best = -1, bs = [], work = 0;
      const cur = [];
      const accs = [new Uint32Array(p.words)], twos = [new Uint32Array(p.words)];
      const rec = (j, spent) => {
        work++;
        const a = accs[cur.length], t2 = twos[cur.length];
        const v = Survey.yieldOf(p, a, t2);
        if (v > best) { best = v; bs = cur.slice(); }
        for (let k = j; k < m; k++) {
          const c = p.sites[k].cost;
          if (spent + c > p.B) continue;
          const na = new Uint32Array(p.words), nt = new Uint32Array(p.words), b = p.cover[k].bits;
          for (let w = 0; w < p.words; w++) { nt[w] = t2[w] | (a[w] & b[w]); na[w] = a[w] | b[w]; }
          cur.push(k); accs[cur.length] = na; twos[cur.length] = nt;
          rec(k + 1, spent + c);
          cur.pop();
        }
      };
      rec(0, 0);
      return { solution: bs, value: best, work, proven: true };
    },
    charted(p) { return Survey.exact(p); },
    format(v) { return fmtNum(round1(v)) + ' t'; },
    // Every layout within budget one change away: a rig added, removed, or swapped for another.
    moves(p, s) {
      const out = [], spent = Survey.spent(p, s);
      for (let j = 0; j < p.m; j++) {
        if (s.includes(j)) { out.push(s.filter((x) => x !== j)); continue; }
        if (spent + p.sites[j].cost <= p.B) out.push(s.concat([j]));
        for (let i = 0; i < s.length; i++) if (spent - p.sites[s[i]].cost + p.sites[j].cost <= p.B) { const c = s.slice(); c[i] = j; out.push(c); }
      }
      return out;
    },
    describe(p, s) { return s.map((i) => p.names[i]).join(', '); },
  };

  // =====================================================================
  // BLOCKADE: jam every lane at minimum power.
  // =====================================================================
  function segCross(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    if (a === c || a === d || b === c || b === d) return false;
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  }
  const Blockade = {
    type: 'blockade', dir: 'min', unit: 'kc',
    generate(seed, o) {
      const rng = makeRng('blockade|' + seed);
      const n = o.n || 12;
      const pts = placePoints(rng, n, o.minD || Math.max(80, 250 - n * 8));
      // planar lane graph: shortest non-crossing pairs up to a density target
      const pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j, dist(pts[i], pts[j])]);
      pairs.sort((a, b) => a[2] - b[2]);
      const target = Math.round(n * (o.density || 1.7));
      const edges = [];
      const deg = new Array(n).fill(0);
      for (const [i, j] of pairs) {
        if (edges.length >= target) break;
        if (edges.some(([a, b]) => segCross(pts[i], pts[j], pts[a], pts[b]))) continue;
        if (deg[i] >= 5 || deg[j] >= 5) continue;
        edges.push([i, j]); deg[i]++; deg[j]++;
      }
      // connect isolated nodes
      for (let i = 0; i < n; i++) {
        if (deg[i] > 0) continue;
        let bj = -1, bd = Infinity;
        for (let j = 0; j < n; j++) if (j !== i && dist(pts[i], pts[j]) < bd) { bd = dist(pts[i], pts[j]); bj = j; }
        edges.push([i, bj]); deg[i]++; deg[bj]++;
      }
      // busier stations draw more power to jam
      const cost = pts.map((q, i) => Math.max(1, Math.min(4, Math.round(0.4 + (deg[i] - 2) * 0.55 + rng() * 1.6))));
      if (fitted(o, 'wideband')) deg.forEach((d, i) => { if (d >= 4) cost[i] = Math.max(1, cost[i] - 1); });
      const adj = pts.map(() => []);
      edges.forEach(([a, b], k) => { adj[a].push([b, k]); adj[b].push([a, k]); });
      const names = rng.shuffle(BIRDS).slice(0, n);
      return { type: 'blockade', seed, n, pts, edges, cost, adj, names, mods: modsOf(o) };
    },
    empty() { return []; },
    uncovered(p, s) {
      const on = new Set(s);
      return p.edges.map((e, k) => k).filter((k) => !on.has(p.edges[k][0]) && !on.has(p.edges[k][1]));
    },
    complete(p, s) { return Blockade.uncovered(p, s).length === 0; },
    value(p, s) { return s.reduce((a, i) => a + p.cost[i], 0); },
    evaluate(p, s) {
      const u = Blockade.uncovered(p, s).length;
      return { valid: u === 0, value: Blockade.value(p, s), note: u ? u + ' lanes open' : '' };
    },
    ratioPick(p, s) {
      const on = new Set(s);
      let best = -1, br = -1;
      for (let v = 0; v < p.n; v++) {
        if (on.has(v)) continue;
        let c = 0;
        for (const [u] of p.adj[v]) if (!on.has(u)) c++;
        const r = c / p.cost[v];
        if (c > 0 && r > br) { br = r; best = v; }
      }
      return best;
    },
    machine(p) {
      const s = [];
      let work = 0;
      while (!Blockade.complete(p, s)) { s.push(Blockade.ratioPick(p, s)); work += p.n; }
      return { solution: s, work, procedure: 'Busiest-first: jam the station covering the most open lanes per kc, until every lane is jammed.' };
    },
    polish(p, s) {
      if (!Blockade.complete(p, s)) return { ok: false, reason: 'Lanes still open. Jam every lane, then this engine may refine the layout.' };
      let t = s.slice();
      let changed = true, guard = 0;
      while (changed && guard++ < 100) {
        changed = false;
        // 1) drop redundant jammers, most expensive first
        const order = t.slice().sort((a, b) => p.cost[b] - p.cost[a]);
        for (const v of order) {
          const without = t.filter((x) => x !== v);
          if (Blockade.complete(p, without)) { t = without; changed = true; }
        }
        // 2) swap one jammer for its unjammed neighbours when cheaper
        for (const v of t.slice()) {
          const on = new Set(t);
          const nb = [...new Set(p.adj[v].map(([u]) => u))].filter((u) => !on.has(u));
          const c = nb.reduce((a, u) => a + p.cost[u], 0);
          if (c < p.cost[v]) { t = t.filter((x) => x !== v).concat(nb); changed = true; break; }
        }
      }
      return { ok: true, solution: t };
    },
    suggest(p, s) {
      if (!Blockade.complete(p, s)) {
        const v = Blockade.ratioPick(p, s);
        return { kind: 'next', node: v, text: 'Advisory: jam ' + p.names[v] + '.' };
      }
      const r = Blockade.polish(p, s);
      if (Blockade.value(p, r.solution) < Blockade.value(p, s)) return { kind: 'polish', text: 'A polish pass would save power.' };
      return { kind: 'none', text: 'No redundant jammer found.' };
    },
    exact(p) {
      const n = p.n;
      const init = Blockade.polish(p, Blockade.machine(p).solution).solution;
      let best = Blockade.value(p, init), bs = init.slice(), work = 0;
      const state = new Int8Array(n); // 0 undecided, 1 in, -1 out
      const lowerBound = () => {
        // greedy matching over uncovered edges: sum of cheaper endpoint
        const used = new Uint8Array(n);
        let lb = 0;
        for (const [a, b] of p.edges) {
          if (state[a] === 1 || state[b] === 1) continue;
          if (used[a] || used[b]) continue;
          used[a] = used[b] = 1;
          lb += Math.min(state[a] === -1 ? Infinity : p.cost[a], state[b] === -1 ? Infinity : p.cost[b]);
        }
        return lb;
      };
      const rec = (cost) => {
        work++;
        if (work > 3e6) return;
        if (cost + lowerBound() >= best) return;
        // pick undecided vertex with most uncovered lanes
        let v = -1, bd = 0;
        for (let i = 0; i < n; i++) {
          if (state[i] !== 0) continue;
          let d = 0;
          for (const [u] of p.adj[i]) if (state[u] !== 1) d++;
          if (d > bd) { bd = d; v = i; }
        }
        if (v < 0) {
          // all lanes covered?
          for (const [a, b] of p.edges) if (state[a] !== 1 && state[b] !== 1) return;
          best = cost; bs = []; for (let i = 0; i < n; i++) if (state[i] === 1) bs.push(i);
          return;
        }
        // branch 1: jam v
        state[v] = 1; rec(cost + p.cost[v]); state[v] = 0;
        // branch 2: do not jam v, so every neighbour must be jammed
        const nb = [...new Set(p.adj[v].map(([u]) => u))];
        if (nb.some((u) => state[u] === -1)) return;
        const added = [];
        let c = cost;
        state[v] = -1;
        for (const u of nb) if (state[u] === 0) { state[u] = 1; added.push(u); c += p.cost[u]; }
        rec(c);
        for (const u of added) state[u] = 0;
        state[v] = 0;
      };
      rec(0);
      return { solution: bs, value: best, work, proven: work <= 3e6 };
    },
    charted(p) { return Blockade.exact(p); },
    // Every plan one change away: one station's jammer switched. Some leave a lane open.
    moves(p, s) {
      const out = [];
      for (let v = 0; v < p.n; v++) out.push(s.includes(v) ? s.filter((x) => x !== v) : s.concat([v]));
      return out;
    },
    format(v) { return v + ' kc'; },
    describe(p, s) { return s.map((i) => p.names[i]).join(', '); },
  };

  // =====================================================================
  // TREATY: choose terms to win the most weighted support.
  // =====================================================================
  const TERM_POOL = [
    'Tollgate inspections', 'Tariff holiday', 'Salvage rights at Marrow', 'Escorted convoys',
    'Joint watch at the Quiet', 'Open engine registry', 'Amnesty for old engines',
    'Bazaar curfew', 'Ore price floor', 'Cutter patrols in the belt', 'Sealed cargo honored',
    'Lantern stays dark', 'Relay neutrality', 'Cinder closed to crews', 'Union seat at Tollgate',
    'Vesper bubble widened',
  ];
  const DELEGATES = [
    { key: 'vey', name: 'Inquisitor Vey', faction: 'Inquisition' },
    { key: 'pell', name: 'Factor Pell', faction: 'Consortium' },
    { key: 'rook', name: 'Foreman Rook', faction: 'Miners’ Union' },
    { key: 'winter', name: 'Winter (through you)', faction: 'Augmented' },
  ];
  const Treaty = {
    type: 'treaty', dir: 'max', unit: 'accord',
    generate(seed, o) {
      if (o.fixed) {
        const f = o.fixed;
        return { type: 'treaty', seed, n: f.terms.length, terms: f.terms, delegates: f.delegates, clauses: f.clauses, tongue: fitted(o, 'tongue'), mods: modsOf(o) };
      }
      const rng = makeRng('treaty|' + seed);
      const n = o.n || 9;
      const terms = rng.shuffle(TERM_POOL).slice(0, n);
      const perDel = o.perDelegate || Math.round(n * 0.75);
      const clauses = [];
      const seen = new Set();
      DELEGATES.forEach((d, di) => {
        let made = 0, guard = 0;
        while (made < perDel && guard++ < 500) {
          const a = rng.int(0, n - 1);
          let b = rng.int(0, n - 1);
          const unit = rng() < 0.18;
          if (!unit && a === b) continue;
          const lits = unit ? [[a, rng() < 0.5]] : [[a, rng() < 0.5], [b, rng() < 0.5]];
          const key = JSON.stringify(lits.slice().sort());
          if (seen.has(key)) continue;
          seen.add(key);
          clauses.push({ lits, w: rng.int(1, 3), who: di });
          made++;
        }
      });
      return { type: 'treaty', seed, n, terms, delegates: DELEGATES, clauses, tongue: fitted(o, 'tongue'), mods: modsOf(o) };
    },
    empty(p) { return new Array(p.n).fill(false); },
    complete() { return true; },
    sat(c, a) { return c.lits.some(([v, pos]) => a[v] === pos); },
    // The support won. With Silver Tongue, the single heaviest unmet demand counts as met.
    value(p, a) {
      let v = 0, miss = 0;
      for (const c of p.clauses) { if (Treaty.sat(c, a)) v += c.w; else if (c.w > miss) miss = c.w; }
      return v + (p.tongue ? miss : 0);
    },
    // Every term sheet one change away: one term switched.
    moves(p, a) { return a.map((on, v) => { const t = a.slice(); t[v] = !t[v]; return t; }); },
    total(p) { return p.clauses.reduce((s, c) => s + c.w, 0); },
    evaluate(p, a) { return { valid: true, value: Treaty.value(p, a), note: '' }; },
    machine(p) {
      const a = new Array(p.n).fill(null);
      let work = 0;
      for (let v = 0; v < p.n; v++) {
        let wt = 0, wf = 0;
        for (const c of p.clauses) {
          work++;
          if (c.lits.some(([u, pos]) => a[u] !== null && a[u] === pos)) continue; // already satisfied
          for (const [u, pos] of c.lits) if (u === v) { if (pos) wt += c.w; else wf += c.w; }
        }
        a[v] = wt > wf;
      }
      return { solution: a, work, procedure: 'Term by term, in agenda order: take whichever side of each term satisfies more demands still open. Never revisit.' };
    },
    polish(p, a) {
      const t = a.slice();
      let improved = true, guard = 0;
      while (improved && guard++ < 200) {
        improved = false;
        const base = Treaty.value(p, t);
        let bg = 0, bv = -1;
        for (let v = 0; v < p.n; v++) {
          t[v] = !t[v];
          const g = Treaty.value(p, t) - base;
          t[v] = !t[v];
          if (g > bg) { bg = g; bv = v; }
        }
        if (bv >= 0) { t[bv] = !t[bv]; improved = true; }
      }
      return { ok: true, solution: t };
    },
    suggest(p, a) {
      const base = Treaty.value(p, a);
      let bg = 0, bv = -1;
      for (let v = 0; v < p.n; v++) {
        const t = a.slice(); t[v] = !t[v];
        const g = Treaty.value(p, t) - base;
        if (g > bg) { bg = g; bv = v; }
      }
      if (bv < 0) return { kind: 'none', text: 'No single term change wins more support.' };
      return { kind: 'next', node: bv, text: 'Advisory: ' + (a[bv] ? 'drop' : 'add') + ' “' + p.terms[bv] + '” (+' + bg + ').' };
    },
    exact(p) {
      const n = p.n;
      let best = -1, bm = 0, work = 0;
      const a = new Array(n);
      for (let mask = 0; mask < (1 << n); mask++) {
        for (let v = 0; v < n; v++) a[v] = !!(mask & (1 << v));
        work++;
        const val = Treaty.value(p, a);
        if (val > best) { best = val; bm = mask; }
      }
      const sol = []; for (let v = 0; v < n; v++) sol.push(!!(bm & (1 << v)));
      return { solution: sol, value: best, work, proven: true };
    },
    charted(p) { return Treaty.exact(p); },
    format(v) { return v + ' accord'; },
    describe(p, a) { return p.terms.filter((t, i) => a[i]).join(', ') || 'no terms'; },
    // readable demand text
    demandText(p, c) {
      const T = (i) => '“' + p.terms[i] + '”';
      const [l1, l2] = c.lits;
      if (!l2) return l1[1] ? T(l1[0]) + ' must be in.' : T(l1[0]) + ' must stay out.';
      const [a, pa] = l1, [b, pb] = l2;
      if (pa && pb) return 'At least one of ' + T(a) + ' or ' + T(b) + '.';
      if (!pa && !pb) return 'Not both ' + T(a) + ' and ' + T(b) + '.';
      if (!pa && pb) return 'If ' + T(a) + ', then ' + T(b) + '.';
      return 'If ' + T(b) + ', then ' + T(a) + '.';
    },
  };

  // =====================================================================
  // ENGAGEMENT: hold out until the drive spools. Disable and escape, never destroy.
  // No dice: every enemy shot is on the schedule before the plan is filed.
  //
  // A plan is one dial and a kill order: [guns, part, part, ...]. Each round the guns spend up to
  // `guns` power, a point of plating for a point of power, working down the order. Whatever power
  // is left raises the shield arcs that block the most fire.
  // =====================================================================
  const ARCS = ['FORE', 'PORT', 'STARBOARD', 'AFT'];
  const SHIELD = 2;   // damage one raised arc blocks in a round
  const RESERVE = 10; // hull left when every shot lands and every penalty applies
  // One doctrine per faction: how its ships are built and how they fight. `rate` is the chance a
  // mount fires in a given round. `special` adds one subsystem with a rule of its own.
  const DOCTRINES = {
    inquisition: { name: 'INQUISITION CUTTER', thr: [2, 4], dmg: [2, 3], rate: 0.7, sensor: [3, 5], engine: [1, 2], tracked: 5, special: 'grapple', specialThr: [2, 3], seized: 8 },
    armada: { name: 'ARMADA RAIDER', thr: [1, 3], dmg: [3, 4], rate: 0.8, sensor: [2, 4], engine: [1, 2], tracked: 4, extraMount: 1 },
    guild: { name: 'GUILD SECURITY', thr: [4, 6], dmg: [3, 4], rate: 0.7, sensor: [2, 4], engine: [3, 4], tracked: 3, extraRound: 1, fewerMounts: 1 },
    market: { name: 'ENFORCER', thr: [2, 4], dmg: [2, 4], rate: 0.7, sensor: [2, 4], engine: [1, 2], tracked: 4, special: 'drain', specialThr: [1, 3] },
  };
  const Engagement = {
    type: 'engagement', dir: 'max', unit: 'hull', ARCS, SHIELD, DOCTRINES,
    generate(seed, o) {
      const rng = makeRng('engagement|' + seed);
      const doctrine = o.doctrine || rng.pick(Object.keys(DOCTRINES));
      const d = DOCTRINES[doctrine];
      const R = (o.rounds || 4) + (d.extraRound || 0);
      const total = o.subs || 5;
      const between = ([lo, hi]) => rng.int(lo, hi);
      // `soft` thins every subsystem a little, for the small fights on a small reactor.
      const plate = (range) => Math.max(1, between(range) - (o.soft || 0));
      // Subsystems: mounts first, then sensors, engines and the doctrine's special.
      const mounts = Math.max(2, total - 2 + (d.extraMount || 0) - (d.fewerMounts || 0));
      const subs = [];
      for (let i = 0; i < mounts; i++) {
        const dmg = between(d.dmg), arc = rng.int(0, 3);
        const shots = [];
        for (let r = 0; r < R; r++) if (rng() < d.rate) shots.push({ round: r, dmg, arc });
        if (!shots.length) shots.push({ round: rng.int(0, R - 1), dmg, arc });
        subs.push({ kind: 'mount', name: 'MOUNT ' + String.fromCharCode(65 + i), thr: plate(d.thr), dmg, arc, shots });
      }
      subs.push({ kind: 'sensor', name: 'SENSORS', thr: plate(d.sensor) });
      subs.push({ kind: 'engine', name: 'ENGINES', thr: plate(d.engine) });
      if (d.special) subs.push({ kind: d.special, name: d.special.toUpperCase(), thr: plate(d.specialThr) });
      const at = (kind) => subs.findIndex((x) => x.kind === kind);
      const tracked = d.tracked, seized = d.seized || 0;
      const worst = subs.reduce((a, x) => a + (x.shots || []).reduce((b, sh) => b + sh.dmg, 0), 0) + tracked + (at('grapple') >= 0 ? seized : 0);
      return { type: 'engagement', seed, doctrine, enemy: d.name, R, P: o.power || 5, subs,
        sensor: at('sensor'), engine: at('engine'), grapple: at('grapple'), drain: at('drain'),
        tracked, seized, hull: worst + RESERVE,
        shield: [SHIELD, SHIELD, SHIELD, fitted(o, 'aft') ? SHIELD * 2 : SHIELD], mods: modsOf(o) };
    },
    // No targets, and most of the reactor on the guns for when there are.
    empty(p) { return [Math.max(1, p.P - 2)]; },
    guns(s) { return s[0]; },
    order(s) { return s.slice(1); },
    // Power the reactor gives in a round, given what is still running at its start.
    power(p, rem) { return p.P - (p.drain >= 0 && rem[p.drain] > 0 ? 1 : 0); },
    // With the engines dark at the start of the last round, the ship jumps a round early.
    over(p, r, rem) { return r >= p.R || (r === p.R - 1 && p.engine >= 0 && rem[p.engine] === 0); },
    incoming(p, r, rem) {
      const inc = [0, 0, 0, 0];
      p.subs.forEach((x, i) => { if (x.shots && rem[i] > 0) for (const sh of x.shots) if (sh.round === r) inc[sh.arc] += sh.dmg; });
      return inc;
    },
    penalty(p, rem) {
      return (p.sensor >= 0 && rem[p.sensor] > 0 ? p.tracked : 0) + (p.grapple >= 0 && rem[p.grapple] > 0 ? p.seized : 0);
    },
    // Would darkening part i still change anything after round r? The guns skip what would not:
    // a mount with no shots left, or engines and a drain in the last round.
    matters(p, i, r) {
      const x = p.subs[i];
      return x.shots ? x.shots.some((sh) => sh.round > r) : x.kind === 'sensor' || x.kind === 'grapple' || r < p.R - 1;
    },
    complete(p, s) {
      if (!Array.isArray(s) || !Number.isInteger(s[0]) || s[0] < 0 || s[0] > p.P) return false;
      const order = s.slice(1);
      return new Set(order).size === order.length && order.every((i) => Number.isInteger(i) && i >= 0 && i < p.subs.length);
    },
    // Fly a plan. Both sides fire at once: a mount must be dark before its round to cancel its shot.
    simulate(p, s) {
      const valid = Engagement.complete(p, s);
      const guns = valid ? s[0] : 0, order = valid ? s.slice(1) : [];
      const rem = p.subs.map((x) => x.thr);
      const rounds = [];
      let damage = 0;
      for (let r = 0; !Engagement.over(p, r, rem); r++) {
        const avail = Engagement.power(p, rem), inc = Engagement.incoming(p, r, rem);
        let left = Math.min(guns, avail);
        const fired = [];
        for (const i of order) {
          if (left <= 0) break;
          if (rem[i] <= 0 || !Engagement.matters(p, i, r)) continue;
          const hit = Math.min(rem[i], left);
          rem[i] -= hit; left -= hit;
          fired.push({ tgt: i, hit });
        }
        const spent = Math.min(guns, avail) - left;
        // Every arc costs 1, so the arcs that block the most are the best use of what is left.
        const up = [false, false, false, false];
        [0, 1, 2, 3].filter((a) => inc[a] > 0).sort((a, b) => Math.min(p.shield[b], inc[b]) - Math.min(p.shield[a], inc[a]) || a - b)
          .slice(0, avail - spent).forEach((a) => { up[a] = true; });
        const taken = inc.reduce((a, v, i) => a + Math.max(0, v - (up[i] ? p.shield[i] : 0)), 0);
        damage += taken;
        rounds.push({ r, avail, guns: spent, fired, up, inc, taken, rem: rem.slice() });
      }
      const tracked = p.sensor >= 0 && rem[p.sensor] > 0, seized = p.grapple >= 0 && rem[p.grapple] > 0;
      return { valid, rounds, damage, tracked, seized, value: p.hull - damage - Engagement.penalty(p, rem) };
    },
    evaluate(p, s) {
      const r = Engagement.simulate(p, s);
      return { valid: r.valid, value: r.value, note: r.valid && s.length === 1 ? 'No targets: shields only' : '' };
    },
    // What a part is worth to NAV-7: the fire on its schedule, or the cost of being tracked or
    // seized. The engines and a drain are worth nothing to it.
    worth(p, i) {
      const x = p.subs[i];
      return x.shots ? x.shots.reduce((a, sh) => a + sh.dmg, 0) : x.kind === 'sensor' ? p.tracked : x.kind === 'grapple' ? p.seized : 0;
    },
    machine(p) {
      const ratio = (i) => Engagement.worth(p, i) / p.subs[i].thr;
      const order = p.subs.map((x, i) => i).filter((i) => Engagement.worth(p, i) > 0).sort((a, b) => ratio(b) - ratio(a) || a - b);
      return { solution: [Math.ceil(p.P / 2)].concat(order), work: p.subs.length,
        procedure: 'Biggest threat for the plating: rank every part by the fire it carries, or the penalty it brings, against how hard it is to darken. Take them in that order with half the reactor on the guns. Never looks at the schedule.' };
    },
    // Every plan one change away: the dial up or down, a part dropped, a part added anywhere, or
    // two neighbours in the order swapped.
    neighbours(p, s) {
      const out = [], guns = s[0], order = s.slice(1);
      const plan = (g, o) => [g].concat(o);
      if (guns > 0) out.push({ sol: plan(guns - 1, order), kind: 'dial', guns: guns - 1 });
      if (guns < p.P) out.push({ sol: plan(guns + 1, order), kind: 'dial', guns: guns + 1 });
      order.forEach((i, k) => out.push({ sol: plan(guns, order.filter((x) => x !== i)), kind: 'drop', i }));
      for (let i = 0; i < p.subs.length; i++) {
        if (order.includes(i)) continue;
        for (let k = 0; k <= order.length; k++) out.push({ sol: plan(guns, order.slice(0, k).concat([i], order.slice(k))), kind: 'add', i, before: k < order.length ? order[k] : -1 });
      }
      for (let k = 0; k + 1 < order.length; k++) {
        const o = order.slice(); [o[k], o[k + 1]] = [o[k + 1], o[k]];
        out.push({ sol: plan(guns, o), kind: 'swap', i: order[k + 1], before: order[k] });
      }
      return out;
    },
    // Naming a target is the pilot's call (Statute 4.1): an advisory may propose one, polish may not.
    bestChange(p, s, mayAdd) {
      const base = Engagement.simulate(p, s).value;
      let best = null;
      for (const n of Engagement.neighbours(p, s)) {
        if (n.kind === 'add' && !mayAdd) continue;
        const v = Engagement.simulate(p, n.sol).value;
        if (v > (best ? best.value : base)) best = Object.assign(n, { value: v, gain: v - base });
      }
      return best;
    },
    polish(p, s) {
      if (!Engagement.complete(p, s) || s.length < 2) return { ok: false, reason: 'No kill order yet. Name at least one target, then this engine may refine it.' };
      let t = s.slice();
      for (let guard = 0; guard < 200; guard++) {
        const b = Engagement.bestChange(p, t);
        if (!b) break;
        t = b.sol;
      }
      return { ok: true, solution: t };
    },
    suggest(p, s) {
      const b = Engagement.complete(p, s) ? Engagement.bestChange(p, s, true) : null;
      if (!b) return { kind: 'none', text: 'No single change saves more hull.' };
      const name = (i) => p.subs[i].name;
      const what = b.kind === 'dial' ? 'guns to ' + b.guns
        : b.kind === 'drop' ? 'leave ' + name(b.i) + ' alone'
          : (b.kind === 'add' ? 'add ' : 'take ') + name(b.i) + (b.before >= 0 ? ' before ' + name(b.before) : ' last');
      return { kind: 'next', node: b.kind === 'dial' ? -1 : b.i, text: 'Advisory: ' + what + ' (+' + b.gain + ' hull).' };
    },
    // The archive's answer: every dial setting with every kill order, flown and compared.
    exact(p) {
      let best = null, work = 0;
      const fly = (s) => { work++; const v = Engagement.simulate(p, s).value; if (!best || v > best.value) best = { solution: s.slice(), value: v }; };
      fly([0]);
      for (let guns = 1; guns <= p.P; guns++) {
        const s = [guns], used = new Array(p.subs.length).fill(false);
        const extend = () => {
          fly(s);
          for (let i = 0; i < p.subs.length; i++) {
            if (used[i]) continue;
            used[i] = true; s.push(i); extend(); s.pop(); used[i] = false;
          }
        };
        extend();
      }
      return { solution: best.solution, value: best.value, work, proven: true };
    },
    charted(p) { return Engagement.exact(p); },
    // What polish may try: the dial, a target dropped, two neighbours swapped. Never a new target.
    moves(p, s) { return Engagement.neighbours(p, s).filter((n) => n.kind !== 'add').map((n) => n.sol); },
    format(v) { return v + ' hull'; },
    describe(p, s) {
      return 'Guns ' + s[0] + '. ' + (s.length > 1 ? 'Order: ' + s.slice(1).map((i) => p.subs[i].name).join(', ') : 'No targets') + '.';
    },
  };

  const TYPES = { haul: Haul, survey: Survey, blockade: Blockade, treaty: Treaty, engagement: Engagement };

  // percent of charted best (100 = matches best)
  function pctOf(mod, value, best) {
    if (value == null || best == null) return null;
    if (mod.dir === 'min') return value <= 0 ? 100 : Math.min(100, (best / value) * 100);
    return best <= 0 ? 100 : Math.min(100, (value / best) * 100);
  }
  function better(mod, a, b) { return mod.dir === 'min' ? a < b - 1e-9 : a > b + 1e-9; }

  // Deep polish (an engine mod): ordinary polish, then look two changes ahead. It may take a
  // step that does not pay by itself when the step after it more than repays it. NAV-7 alone
  // never gets this, and the charted best does not need it.
  function deepPolish(mod, p, s) {
    const first = mod.polish(p, s);
    if (!first.ok) return first;
    let t = first.solution, tv = mod.evaluate(p, t).value;
    for (let guard = 0; guard < 20; guard++) {
      let best = null, bv = tv;
      for (const a of mod.moves(p, t)) {
        for (const b of mod.moves(p, a)) {
          const e = mod.evaluate(p, b);
          if (e.valid && better(mod, e.value, bv)) { bv = e.value; best = b; }
        }
      }
      if (!best) break;
      t = mod.polish(p, best).solution; tv = mod.evaluate(p, t).value;
    }
    return { ok: true, solution: t };
  }

  const SIZES = {
    haul: { S: { n: 8 }, M: { n: 11 }, L: { n: 14 } },
    survey: { S: { sites: 14, budget: 6, deposits: 40 }, M: { sites: 18, budget: 8, deposits: 54 }, L: { sites: 22, budget: 10, deposits: 70 } },
    blockade: { S: { n: 11 }, M: { n: 15 }, L: { n: 20 } },
    treaty: { S: { n: 8 }, M: { n: 10 }, L: { n: 13 } },
    engagement: {
      S: { rounds: 3, subs: 4, power: 4, soft: 1 },
      M: { rounds: 4, subs: 5, power: 5 },
      L: { rounds: 5, subs: 6, power: 5 },
    },
  };

  // A refit haul in the Arcade runs near a patrol: its map carries a sensor bubble, so Ghost Hull
  // has something to soften. Plain arcade maps have none, so their seeds are unchanged.
  const REFIT_HAZARD = { S: { r: 130, mult: 2.4 }, M: { r: 150, mult: 2.4 }, L: { r: 160, mult: 2.4 } };

  const api = { RIG, makeRng, hashSeed, TYPES, SIZES, REFIT_HAZARD, MODULES, SLOTS, deepPolish, pctOf, better, W, H, ORE, BIRDS, DELEGATES, round1 };
  root.K9Engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
