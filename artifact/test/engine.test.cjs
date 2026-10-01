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
      let opt = 0, maxMs = 0;
      const n = 40;
      for (let k = 0; k < n; k++) {
        const p = mod.generate('d' + k + size, Object.assign({}, E.SIZES.engagement[size], { doctrine }));
        const tag = 'engagement ' + doctrine + ' ' + size;
        assert(p.doctrine === doctrine && (doctrine === 'guild') === (p.R === E.SIZES.engagement[size].rounds + 1), tag + ' rounds');
        assert((p.grapple >= 0) === (doctrine === 'inquisition') && (p.drain >= 0) === (doctrine === 'market'), tag + ' special subsystem');
        const nothing = mod.evaluate(p, mod.empty(p));
        assert(nothing.valid && nothing.value === 10, tag + ' doing nothing leaves the reserve');
        const t0 = Date.now(); const ch = mod.charted(p); maxMs = Math.max(maxMs, Date.now() - t0);
        const cv = mod.evaluate(p, ch.solution);
        assert(ch.proven && cv.valid && cv.value === ch.value, tag + ' charted');
        const m = mod.machine(p).solution, mv = mod.evaluate(p, m);
        assert(mv.valid && mv.value <= ch.value, tag + ' machine');
        const po = mod.polish(p, m), pv = mod.evaluate(p, po.solution);
        assert(po.ok && pv.valid && pv.value >= mv.value && pv.value <= ch.value, tag + ' polish');
        const hint = mod.suggest(p, mod.empty(p));
        assert(hint.kind === 'none' || (hint.kind === 'next' && /^Advisory: round \d/.test(hint.text)), tag + ' advisory');
        const over = mod.empty(p); for (let w = 0; w < p.W; w++) over[w] = 0; for (let a = 0; a < 4; a++) over[p.W + a] = 1;
        assert(!mod.evaluate(p, over).valid && !mod.polish(p, over).ok, tag + ' a round over power is not a plan');
        if (mv.value === ch.value) opt++;
      }
      console.log('engagement', doctrine.padEnd(11), size, 'machine optimal', opt + '/' + n, '| charted ms max', maxMs);
    }
  }
}
