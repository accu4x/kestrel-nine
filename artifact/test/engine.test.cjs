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
