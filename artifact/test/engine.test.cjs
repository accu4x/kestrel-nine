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
