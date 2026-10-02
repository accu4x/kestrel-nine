// Node test: node artifact/test/engine.test.cjs
const E = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } };
const stats = {};
for (const type of Object.keys(E.TYPES)) {
  const mod = E.TYPES[type];
  for (const size of ['S', 'M', 'L']) {
    const pcts = [], pol = [], times = [];
    let exactCount = 0;
    for (let k = 0; k < 25; k++) {
      const p = mod.generate('t' + k + size, E.SIZES[type][size]);
      const t0 = Date.now();
      const ch = mod.charted(p);
      times.push(Date.now() - t0);
      if (ch.proven) exactCount++;
      const m = mod.machine(p).solution;
      const ev = mod.evaluate(p, m);
      assert(ev.valid, type + size + ' machine invalid');
      const cv = mod.evaluate(p, ch.solution);
      assert(cv.valid, type + size + ' charted invalid');
      assert(Math.abs(cv.value - ch.value) < 1e-6, type + ' charted value mismatch ' + cv.value + ' ' + ch.value);
      assert(!E.better(mod, ev.value, ch.value) || !ch.proven, type + size + ' machine beat exact!');
      const po = mod.polish(p, m);
      assert(po.ok, type + ' polish failed');
      const pv = mod.evaluate(p, po.solution);
      assert(pv.valid, type + ' polish invalid');
      assert(!E.better(mod, ev.value, pv.value), type + ' polish worsened');
      pcts.push(E.pctOf(mod, ev.value, ch.value));
      pol.push(E.pctOf(mod, pv.value, ch.value));
    }
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
    const opt = (a) => a.filter((x) => x > 99.99).length;
    console.log(type, size, 'machine avg%', avg(pcts), 'machine optimal', opt(pcts) + '/25', '| machine+polish avg%', avg(pol), 'opt', opt(pol) + '/25', '| charted ms max', Math.max(...times), 'proven', exactCount);
  }
}

// Engagement, one enemy doctrine at a time (the loop above takes whichever the seed picks).
// The same checks, plus the rules the doctrines add, and how often NAV-7 alone is optimal.
{
  const mod = E.TYPES.engagement;
  for (const doctrine of Object.keys(mod.DOCTRINES)) {
    for (const size of ['S', 'M', 'L']) {
      let opt = 0, maxMs = 0, taps = 0;
      const n = 40;
      for (let k = 0; k < n; k++) {
        const p = mod.generate('d' + k + size, Object.assign({}, E.SIZES.engagement[size], { doctrine }));
        const tag = 'engagement ' + doctrine + ' ' + size;
        assert(p.doctrine === doctrine && (doctrine === 'guild') === (p.R === E.SIZES.engagement[size].rounds + 1), tag + ' rounds');
        assert((p.grapple >= 0) === (doctrine === 'inquisition') && (p.drain >= 0) === (doctrine === 'market'), tag + ' special subsystem');
        const shieldsOnly = mod.evaluate(p, mod.empty(p));
        assert(shieldsOnly.valid && shieldsOnly.value >= 10 && shieldsOnly.value <= p.hull, tag + ' a plan with no targets is flown on shields');
        assert(!mod.polish(p, mod.empty(p)).ok, tag + ' polish refuses a plan with no targets');
        const t0 = Date.now(); const ch = mod.charted(p); maxMs = Math.max(maxMs, Date.now() - t0);
        const cv = mod.evaluate(p, ch.solution);
        assert(ch.proven && cv.valid && cv.value === ch.value && ch.value >= shieldsOnly.value, tag + ' charted');
        taps += ch.solution.length - 1;
        const m = mod.machine(p).solution, mv = mod.evaluate(p, m);
        assert(mv.valid && mv.value <= ch.value, tag + ' machine');
        const po = mod.polish(p, m), pv = mod.evaluate(p, po.solution);
        assert(po.ok && pv.valid && pv.value >= mv.value && pv.value <= ch.value, tag + ' polish');
        assert(po.solution.slice(1).every((i) => m.includes(i, 1)), tag + ' polish never names a new target');
        const hint = mod.suggest(p, mod.empty(p));
        assert(hint.kind === 'none' || (hint.kind === 'next' && /^Advisory: /.test(hint.text)), tag + ' advisory');
        for (const bad of [[], [p.P + 1], [1, 0, 0], [1, p.subs.length], [1.5]]) assert(!mod.evaluate(p, bad).valid, tag + ' malformed plan ' + JSON.stringify(bad));
        if (mv.value === ch.value) opt++;
      }
      console.log('engagement', doctrine.padEnd(11), size, 'machine optimal', opt + '/' + n, '| targets in the best order, avg', (taps / n).toFixed(1), '| charted ms max', maxMs);
    }
  }
}

// Ship modules (OPEN-ITEMS item 32). For each one: every solver still valid under it, the charted
// best still proven and still on top, the rule doing what it says, and NAV-7 alone still beatable.
{
  const C = require('../src/content.js');
  assert(JSON.stringify(Object.keys(C.MODULES).sort()) === JSON.stringify(Object.keys(E.MODULES).sort()), 'content.js names every module the engine has, and no others');
  for (const id of Object.keys(E.MODULES)) {
    const named = C.MODULES[id].name ? [C.MODULES[id].name] : Object.keys(C.PATRONS).map((k) => C.MODULES[id].names[k]);
    assert(named.every((n) => typeof n === 'string' && n.length > 2) && C.MODULES[id].rule.length > 5, 'module ' + id + ' has a name under every patron, and a rule');
  }
  // Ghost Hull needs a bubble, which only campaign maps have: use mission 4's.
  const bubble = C.CAMPAIGN.find((c) => c.id === 'c4').params;
  const cases = {
    ghost: { type: 'haul', sizes: { C4: bubble } },
    light: { type: 'survey' }, overlap: { type: 'survey' }, wideband: { type: 'blockade' }, tongue: { type: 'treaty' }, aft: { type: 'engagement' },
  };
  for (const id of Object.keys(cases)) {
    const mod = E.TYPES[cases[id].type], sizes = cases[id].sizes || E.SIZES[cases[id].type];
    for (const size of Object.keys(sizes)) {
      let opt = 0, helped = 0, maxMs = 0;
      const n = 25;
      for (let k = 0; k < n; k++) {
        const tag = 'module ' + id + ' ' + size + ' #' + k;
        const plain = mod.generate('m' + k + size, sizes[size]);
        const p = mod.generate('m' + k + size, Object.assign({}, sizes[size], { mods: [id] }));
        assert(JSON.stringify(p.mods) === JSON.stringify([id]) && plain.mods.length === 0, tag + ' the map records its loadout');
        const t0 = Date.now(); const ch = mod.charted(p); maxMs = Math.max(maxMs, Date.now() - t0);
        const cv = mod.evaluate(p, ch.solution);
        assert(ch.proven && cv.valid && Math.abs(cv.value - ch.value) < 1e-6, tag + ' charted best proven and consistent');
        const m = mod.machine(p).solution, mv = mod.evaluate(p, m);
        assert(mv.valid && !E.better(mod, mv.value, ch.value), tag + ' machine valid and not above the charted best');
        const po = mod.polish(p, m), pv = mod.evaluate(p, po.solution);
        assert(po.ok && pv.valid && !E.better(mod, mv.value, pv.value) && !E.better(mod, pv.value, ch.value), tag + ' polish');
        // The rule only ever helps: the plain map's best plan, flown under the module, is no worse.
        const base = mod.charted(plain), under = mod.evaluate(p, base.solution);
        assert(under.valid && !E.better(mod, base.value, under.value) && !E.better(mod, under.value, ch.value), tag + ' the module never hurts, and the charted best covers it');
        if (E.better(mod, ch.value, base.value)) helped++;
        if (Math.abs(mv.value - ch.value) < 1e-6) opt++;
      }
      assert(helped > 0, 'module ' + id + ' ' + size + ' changes the best result on at least one map');
      assert(opt < n, 'module ' + id + ' ' + size + ' leaves NAV-7 alone beatable');
      console.log('module', id.padEnd(9), cases[id].type.padEnd(10), size.padEnd(2), 'better best on', helped + '/' + n, '| machine optimal', opt + '/' + n, '| charted ms max', maxMs);
    }
  }
  // The rules, checked directly on one map each.
  {
    const o = E.SIZES.survey.M, a = E.TYPES.survey.generate('rule', o), b = E.TYPES.survey.generate('rule', Object.assign({}, o, { mods: ['light'] }));
    assert(a.sites.every((s, i) => b.sites[i].cost === Math.max(1, s.cost - 1) && b.sites[i].r === s.r && b.sites[i].cls === s.cost), 'light rigs: 1 credit less, minimum 1, same reach');
    const c = E.TYPES.survey.generate('rule', Object.assign({}, o, { mods: ['overlap'] }));
    const all = c.sites.map((s, i) => i), once = E.TYPES.survey.value(a, all), half = E.TYPES.survey.value(c, all);
    const twice = c.deps.reduce((sum, d, i) => sum + (c.cover.filter((cv) => cv.list.includes(i)).length >= 2 ? d.t : 0), 0);
    assert(twice > 0 && Math.abs(half - once - twice / 2) < 1e-6, 'overlap: ore reached twice pays half again, and only that ore');
  }
  {
    const o = E.SIZES.blockade.L, a = E.TYPES.blockade.generate('rule', o), b = E.TYPES.blockade.generate('rule', Object.assign({}, o, { mods: ['wideband'] }));
    assert(a.cost.every((cst, i) => b.cost[i] === (a.adj[i].length >= 4 ? Math.max(1, cst - 1) : cst)) && a.adj.some((x) => x.length >= 4), 'wide-band: only hubs cost less');
  }
  {
    const o = E.SIZES.treaty.M, a = E.TYPES.treaty.generate('rule', o), b = E.TYPES.treaty.generate('rule', Object.assign({}, o, { mods: ['tongue'] }));
    const plan = E.TYPES.treaty.empty(a), miss = Math.max(0, ...a.clauses.filter((cl) => !E.TYPES.treaty.sat(cl, plan)).map((cl) => cl.w));
    assert(miss > 0 && E.TYPES.treaty.value(b, plan) === E.TYPES.treaty.value(a, plan) + miss, 'silver tongue: the heaviest unmet demand counts as met');
  }
  {
    const b = E.TYPES.engagement.generate('rule', Object.assign({}, E.SIZES.engagement.M, { mods: ['aft'] }));
    assert(JSON.stringify(b.shield) === JSON.stringify([2, 2, 2, 4]), 'hardened aft: the aft arc blocks double');
    const ghost = E.TYPES.haul.generate('rule', Object.assign({}, bubble, { mods: ['ghost'] }));
    assert(ghost.hazard.mult === 1.5 && E.TYPES.haul.generate('rule', bubble).hazard.mult === bubble.hazard.mult, 'ghost hull: the bubble costs 1.5 to cross');
  }
  // Deep polish, the engine mod: never worse than polish, never above the charted best, and
  // it finds something polish cannot on at least one map of some job.
  let deeper = 0;
  for (const type of Object.keys(E.TYPES)) {
    const mod = E.TYPES[type];
    let gain = 0, maxMs = 0;
    const n = 15;
    for (let k = 0; k < n; k++) {
      const p = mod.generate('dp' + k, E.SIZES[type].M);
      const start = mod.machine(p).solution;
      const shallow = mod.evaluate(p, mod.polish(p, start).solution).value;
      const t0 = Date.now(); const d = E.deepPolish(mod, p, start); maxMs = Math.max(maxMs, Date.now() - t0);
      const dv = mod.evaluate(p, d.solution);
      assert(d.ok && dv.valid && !E.better(mod, shallow, dv.value) && !E.better(mod, dv.value, mod.charted(p).value), 'deep polish ' + type + ' #' + k);
      if (E.better(mod, dv.value, shallow)) gain++;
    }
    const blank = mod.generate('dp', E.SIZES[type].M);
    assert(E.deepPolish(mod, blank, mod.empty(blank)).ok === mod.polish(blank, mod.empty(blank)).ok, 'deep polish ' + type + ' refuses what polish refuses');
    deeper += gain;
    console.log('deep polish', type.padEnd(10), 'beats polish on', gain + '/' + n, 'M maps from NAV-7\'s plan | ms max', maxMs);
  }
  assert(deeper > 0, 'deep polish finds something polish cannot');
}
