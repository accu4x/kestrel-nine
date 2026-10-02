/* Kestrel Nine: game shell. State, screens, input, scenes, records, rumors. */
(function () {
  'use strict';
  const E = window.K9Engine, R = window.K9Render, C = window.K9Content;
  const COL = R.COL;
  const PUBLIC = !!window.K9_PUBLIC; // public edition: no shared data, no Rumor Net
  const SITE = !!window.K9_SITE; // site edition: installable app, save files, challenge links
  // Seed codes read JOB-SIZE-CODE. A job's code is its label unless content gives a shorter one.
  const CODE = (type) => C.TYPE_INFO[type].code || C.TYPE_INFO[type].label;
  const TYPE_OF = Object.fromEntries(Object.keys(E.TYPES).map((t) => [CODE(t), t]));
  const SEED_RE = new RegExp('^(' + Object.keys(TYPE_OF).join('|') + ')-(S|M|L)-([A-Z0-9]{1,8})$');
  const MODE_COL = { solo: COL.you, centaur: COL.cen, machine: COL.nav, best: COL.best };
  const DIALOG_SCREENS = ['prologue', 'brief', 'debrief'];

  // ------------------------------------------------------------ utilities
  const $ = (s) => document.querySelector(s);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const a = attrs || {};
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const kids = [].concat(arguments[i]);
      for (const c of kids) {
        if (c == null || c === false) continue;
        el.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return el;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('k9.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('k9.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fill = (s, x) => String(s).replace('{x}', x);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const utcDay = () => new Date().toISOString().slice(0, 10);
  const pctTxt = (x) => (x == null ? '—' : (x >= 99.95 ? '100' : x.toFixed(1)) + '%');
  const sgn = (x) => (x > 0 ? '+' + x : String(x));

  // ------------------------------------------------------------ persistent state (per viewer)
  const prog = Object.assign({ done: {}, rep: { aug: 0, con: 0, inq: 0, union: 0 }, runs: [] }, store.get('progress', {}));
  const settings = Object.assign({ crt: true, sound: true }, store.get('settings', {}));
  let callsign = store.get('callsign', '') || ('PILOT-' + Math.floor(100 + Math.random() * 900));
  const saveProg = () => store.set('progress', prog);

  // ------------------------------------------------------------ platform capabilities
  const cap = { db: null, user: null, uid: null, canWrite: null, dbTried: false };
  const cl = window.claude;
  if (cl && typeof cl.use === 'function') {
    cl.use('db').then((d) => { cap.db = d; cap.dbTried = true; onDb(); }).catch(() => { cap.dbTried = true; });
    cl.use('user').then(async (u) => {
      cap.user = u;
      if (u) { cap.uid = await u.id(); cap.canWrite = await u.can('data.write'); }
      renderConsole();
    }).catch(() => {});
  } else {
    cap.dbTried = true;
  }

  // ------------------------------------------------------------ sound
  const Snd = {
    ctx: null,
    init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } },
    tone(f, d, type, vol, slide) {
      if (!settings.sound || !this.ctx) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(vol || 0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.03);
    },
    click() { this.tone(900, 0.04, 'square', 0.025); },
    place() { this.tone(660, 0.06, 'triangle', 0.05, 1.5); },
    undo() { this.tone(500, 0.06, 'square', 0.025, 0.6); },
    err() { this.tone(130, 0.2, 'sawtooth', 0.04); },
    chord() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.045), i * 80)); },
    compute() { for (let i = 0; i < 10; i++) setTimeout(() => this.tone(500 + Math.random() * 1200, 0.03, 'square', 0.018), i * 30); },
    warp() { this.tone(90, 0.7, 'sawtooth', 0.035, 6); },
    type() { this.tone(1400 + Math.random() * 300, 0.012, 'square', 0.008); },
  };

  // ------------------------------------------------------------ game state
  const G = {
    screen: 'title', t: 0, last: 0,
    m: null, hover: -1, dlg: null,
    toast: null, warp: 0, layer: 'all', recordsTab: 'index', saveMsg: '', pendingImport: null,
    cutters: [], sparks: [], replayT: 0,
    remote: { runs: null, rumors: null, canon: null, daily: {} },
  };
  const scr = new R.Screen($('#crt'));
  scr.fx = settings.crt; scr.reduced = reduced;

  // ------------------------------------------------------------ install and offline (site edition)
  const install = { prompt: null, ios: false, update: false };
  if (SITE) {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    install.ios = !standalone && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; if (G.screen === 'title') renderConsole(); });
    window.addEventListener('appinstalled', () => { install.prompt = null; if (G.screen === 'title') renderConsole(); });
    if ('serviceWorker' in navigator) {
      const sw = navigator.serviceWorker;
      window.addEventListener('load', () => { sw.register('sw.js').catch(() => { /* plays online without it */ }); });
      // A new build's worker takes over a page that is still showing the old build. Reload at once
      // on the title screen; anywhere else leave the run alone and offer the reload there later.
      // The first install also changes the controller, and that one is not an update.
      let controlled = !!sw.controller;
      sw.addEventListener('controllerchange', () => {
        const isUpdate = controlled;
        controlled = true;
        if (!isUpdate) return;
        if (G.screen === 'title') location.reload();
        else install.update = true;
      });
      // An installed app can sit suspended for days: look for a new build when it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sw.ready.then((reg) => reg.update()).catch(() => { /* offline */ });
      });
    }
  }
  function doInstall() {
    const e = install.prompt;
    install.prompt = null;
    if (!e) return;
    e.prompt();
    e.userChoice.then(() => renderConsole(), () => renderConsole());
  }

  function go(screen) {
    G.screen = screen; G.hover = -1; G.clearNext = true;
    if (screen !== 'play') G.cutters = [];
    renderConsole(); renderStatus();
    const c = $('#console'); if (c) c.scrollTop = 0;
  }
  function toast(msg, color) { G.toast = { msg, t: G.t, color: color || COL.text }; }

  // ------------------------------------------------------------ mission runs
  function startRun(spec) {
    const mod = E.TYPES[spec.type];
    const p = mod.generate(spec.seed, spec.params);
    G.m = Object.assign({}, spec, {
      mod, p, phase: 'solo', sol: mod.empty(p), undo: [], solo: null, cen: null,
      adv: 3, polishes: 0, advNode: -1, navLog: [], machine: null, charted: null, logged: false, posted: false,
    });
    G.cutters = [];
    if (spec.type === 'blockade') seedCutters();
  }
  function campaignSpec(def) {
    return { kind: 'campaign', def, id: def.id, type: def.type, seed: def.seed, params: def.params, seedKey: def.id,
      title: def.title, place: def.place, objective: def.objective, contact: contactOf(def) };
  }
  function contactOf(def) {
    const who = (def.brief || []).find((n) => n.who && ['winter', 'vey', 'pell', 'rook'].includes(n.who));
    return who ? who.who : 'winter';
  }
  function dailySpec(type) {
    const day = utcDay();
    return { kind: 'daily', type, seed: 'daily-' + day + '-' + type, params: E.SIZES[type].M, seedKey: 'd-' + day + '-' + type,
      title: 'Daily ' + C.TYPE_INFO[type].label.toLowerCase(), place: 'Daily seed · ' + day, objective: objectiveFor(type), contact: 'winter', day };
  }
  function arcadeSpec(type, size, code) {
    return { kind: 'arcade', type, seed: 'arcade-' + code, params: E.SIZES[type][size], seedKey: 'a-' + type + '-' + size + '-' + code,
      title: 'Arcade ' + C.TYPE_INFO[type].label.toLowerCase() + ' ' + size, place: 'Seed ' + CODE(type) + '-' + size + '-' + code,
      objective: objectiveFor(type), contact: 'winter', code: CODE(type) + '-' + size + '-' + code };
  }
  function objectiveFor(type) {
    return {
      haul: 'Visit every port and return home by the shortest route.',
      survey: 'Place rigs within the credit budget to raise the most ore.',
      blockade: 'Jam every lane using the least power.',
      treaty: 'Choose the terms that win the most weighted support.',
      engagement: 'Hold out until the drive spools. Keep your hull, and leave their sensors dark.',
    }[type];
  }

  function setSol(next) {
    const m = G.m;
    m.undo.push(Array.isArray(m.sol) ? m.sol.slice() : m.sol);
    if (m.undo.length > 200) m.undo.shift();
    m.sol = next; m.advNode = -1;
    renderConsole();
  }
  function undo() {
    const m = G.m; if (!m || !m.undo.length) return;
    m.sol = m.undo.pop(); Snd.undo(); renderConsole();
  }
  function clearSol() { const m = G.m; setSol(m.mod.empty(m.p)); Snd.undo(); }

  function clickNode(i) {
    const m = G.m, p = m.p, s = m.sol;
    Snd.init();
    if (m.type === 'haul') {
      const at = s.indexOf(i);
      if (at === 0 && s.length === 1) return;
      if (at >= 0) { if (at === s.length - 1 && s.length > 1) setSol(s.slice(0, -1)); else setSol(s.slice(0, at + 1)); Snd.undo(); }
      else { setSol(s.concat([i])); Snd.place(); if (m.mod.complete(p, m.sol)) Snd.chord(); }
    } else if (m.type === 'survey') {
      if (s.includes(i)) { setSol(s.filter((x) => x !== i)); Snd.undo(); }
      else {
        const spent = E.TYPES.survey.spent(p, s);
        if (spent + p.sites[i].cost > p.B) { toast('OVER BUDGET: ' + p.sites[i].cost + ' CR NEEDED, ' + (p.B - spent) + ' LEFT', COL.inq); Snd.err(); return; }
        setSol(s.concat([i])); Snd.place();
      }
    } else if (m.type === 'blockade') {
      if (s.includes(i)) { setSol(s.filter((x) => x !== i)); Snd.undo(); }
      else { setSol(s.concat([i])); Snd.place(); if (m.mod.complete(p, m.sol)) Snd.chord(); }
    } else if (m.type === 'engagement') {
      aimAt(i);
    }
  }
  function toggleTerm(i) {
    const m = G.m; const a = m.sol.slice(); a[i] = !a[i]; setSol(a); Snd.init(); a[i] ? Snd.place() : Snd.undo();
  }
  // Engagement plan: [guns, part, part, ...]. A part is in the kill order or out of it.
  function aimAt(i) {
    const s = G.m.sol, at = s.indexOf(i, 1);
    if (at > 0) { setSol(s.filter((x, k) => k !== at)); Snd.undo(); } else { setSol(s.concat([i])); Snd.place(); }
  }
  function moveAim(i, dir) {
    const s = G.m.sol.slice(), at = s.indexOf(i, 1), to = at + dir;
    if (at < 1 || to < 1 || to >= s.length) return;
    [s[at], s[to]] = [s[to], s[at]]; setSol(s); Snd.place();
  }
  function setGuns(guns) {
    const m = G.m;
    if (guns < 0 || guns > m.p.P) return;
    setSol([guns].concat(m.sol.slice(1))); Snd.place();
  }

  function navSay(line) { G.m.navLog.push(line); if (G.m.navLog.length > 6) G.m.navLog.shift(); }

  function doAdvisory() {
    const m = G.m;
    if (m.adv <= 0) { navSay(pick(C.NAV.noAdvisories)); Snd.err(); renderConsole(); return; }
    const r = m.mod.suggest(m.p, m.sol);
    m.adv--; Snd.compute();
    navSay(r.text);
    if (r.kind === 'next') m.advNode = r.node;
    renderConsole();
  }
  function doPolish() {
    const m = G.m;
    const before = m.mod.evaluate(m.p, m.sol);
    const r = m.mod.polish(m.p, m.sol);
    if (!r.ok) { navSay(r.reason); Snd.err(); toast('NAV-7: PLAN INCOMPLETE', COL.nav); renderConsole(); return; }
    m.polishes++;
    Snd.compute();
    const after = m.mod.evaluate(m.p, r.solution);
    if (E.better(m.mod, after.value, before.value)) {
      const d = Math.abs(after.value - before.value);
      navSay(fill(pick(C.NAV.polishGain), m.mod.format(d)));
      setSol(r.solution);
      G.warp = 0.35;
    } else {
      navSay(pick(C.NAV.polishNone));
      renderConsole();
    }
  }

  function submit() {
    const m = G.m, ev = m.mod.evaluate(m.p, m.sol);
    if (!ev.valid) { toast(ev.note ? ev.note.toUpperCase() : 'PLAN INCOMPLETE', COL.inq); Snd.err(); return; }
    Snd.chord(); G.warp = 1;
    const rec = { solution: Array.isArray(m.sol) ? m.sol.slice() : m.sol, value: ev.value };
    if (m.phase === 'solo') {
      m.solo = rec;
      m.phase = 'link';
      m.navLog = [pick(C.NAV.link)];
      go('play');
    } else if (m.phase === 'centaur') {
      m.cen = rec;
      finish();
    }
  }
  function skipSolo() { const m = G.m; m.solo = null; m.phase = 'link'; m.navLog = [pick(C.NAV.link)]; go('play'); }
  function beginCentaur(fromSolo) {
    const m = G.m;
    m.phase = 'centaur';
    m.sol = fromSolo && m.solo ? (Array.isArray(m.solo.solution) ? m.solo.solution.slice() : m.solo.solution) : m.mod.empty(m.p);
    m.undo = []; m.adv = 3; m.polishes = 0; m.advNode = -1;
    Snd.warp(); G.warp = 1;
    go('play');
  }

  function finish() {
    const m = G.m, mod = m.mod;
    const mach = mod.machine(m.p);
    m.machine = { solution: mach.solution, value: mod.evaluate(m.p, mach.solution).value, work: mach.work, procedure: mach.procedure };
    const ch = mod.charted(m.p);
    m.charted = { solution: ch.solution, value: ch.value, work: ch.work, proven: ch.proven };
    // a pilot can beat an unproven charted best
    for (const r of [m.solo, m.cen]) if (r && E.better(mod, r.value, m.charted.value)) m.charted = { solution: r.solution, value: r.value, work: 0, proven: false };
    const best = m.charted.value;
    m.pct = {
      machine: E.pctOf(mod, m.machine.value, best),
      solo: m.solo ? E.pctOf(mod, m.solo.value, best) : null,
      centaur: E.pctOf(mod, m.cen.value, best),
    };
    const pilotBest = Math.max(m.pct.solo || 0, m.pct.centaur);
    const beatMachine = E.better(mod, m.cen.value, m.machine.value) || (m.solo && E.better(mod, m.solo.value, m.machine.value));
    m.outcome = pilotBest >= 99.95 ? 'optimal' : beatMachine ? 'beat' : 'lost';
    m.centaurWin = E.better(mod, m.cen.value, m.machine.value) && (!m.solo || !E.better(mod, m.solo.value, m.cen.value));
    m.dlgDone = false;
    G.replayT = 0; G.layer = 'all';
    // record locally
    const run = runRecord();
    prog.runs.push(run); if (prog.runs.length > 300) prog.runs.shift();
    if (m.kind === 'campaign') {
      const prev = prog.done[m.id];
      if (!prev || (prev.bestPct || 0) < run.bestPct) prog.done[m.id] = { bestPct: run.bestPct, outcome: m.outcome };
    }
    saveProg();
    // debrief dialog
    const lines = [];
    if (m.kind === 'campaign') {
      const d = m.def.debrief;
      lines.push(...(d[m.outcome] || []));
      lines.push({ who: 'nav', text: fill(pick(C.NAV.reveal), mod.format(m.machine.value)) });
      if (m.outcome === 'optimal' && m.charted.proven) lines.push({ who: 'nav', text: fill(pick(C.NAV.optimal), m.charted.work.toLocaleString('en-US')) });
      else lines.push({ who: 'nav', text: m.centaurWin ? pick(C.NAV.beatBoth) : pick(C.NAV.machineWon) });
      lines.push(...(d.after || []));
    } else {
      lines.push({ who: 'nav', text: fill(pick(C.NAV.reveal), mod.format(m.machine.value)) });
      lines.push({ who: 'nav', text: m.outcome === 'optimal' && m.charted.proven ? fill(pick(C.NAV.optimal), m.charted.work.toLocaleString('en-US')) : m.centaurWin ? pick(C.NAV.beatBoth) : pick(C.NAV.machineWon) });
    }
    startDialog(lines, () => { m.dlgDone = true; renderConsole(); });
    go('debrief');
    postRun(run);
  }

  function runRecord() {
    const m = G.m, mod = m.mod;
    return {
      seedKey: m.seedKey, kind: m.kind, type: m.type, title: m.title, day: m.day || utcDay(),
      dir: mod.dir, machine: m.machine.value, solo: m.solo ? m.solo.value : null, centaur: m.cen.value, best: m.charted.value,
      bestProven: !!m.charted.proven,
      machinePct: m.pct.machine, soloPct: m.pct.solo, centaurPct: m.pct.centaur,
      bestPct: Math.max(m.pct.solo || 0, m.pct.centaur),
      centaurWin: m.centaurWin, polishes: m.polishes, advisoriesUsed: 3 - m.adv,
      ts: Date.now(),
    };
  }

  // ------------------------------------------------------------ shared records (db)
  const safeId = (s) => String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190);
  async function postRun(run) {
    const m = G.m;
    if (!cap.db || !cap.uid) return;
    try {
      const ref = cap.db.collection('runs').doc(safeId(run.seedKey + '~' + cap.uid));
      const cur = await ref.get();
      if (cur.exists && (cur.data().bestPct || 0) >= run.bestPct) { m.posted = 'kept'; renderConsole(); return; }
      await ref.set(Object.assign({}, run, { uid: cap.uid, callsign }));
      m.posted = 'yes';
    } catch (e) {
      m.posted = e && e.code === 'invalid_argument' ? 'readonly' : 'error';
    }
    renderConsole();
  }
  let unsub = [];
  function onDb() {
    if (!cap.db) return;
    try {
      unsub.push(cap.db.collection('runs').orderBy('ts', 'desc').limit(1000).onSnapshot((snap) => {
        G.remote.runs = snap.docs.map((d) => d.data());
        if (['records', 'daily'].includes(G.screen)) renderConsole();
      }, () => { G.remote.runs = null; }));
      unsub.push(cap.db.collection('rumors').orderBy('ts', 'desc').limit(60).onSnapshot((snap) => {
        G.remote.rumors = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        if (G.screen === 'rumors') renderConsole();
      }, () => { G.remote.rumors = null; }));
      unsub.push(cap.db.collection('canon').orderBy('order', 'asc').limit(200).onSnapshot((snap) => {
        G.remote.canon = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        if (G.screen === 'chronicle') renderConsole();
      }, () => { G.remote.canon = null; }));
    } catch (e) { /* db not usable in this view */ }
    renderConsole();
  }
  async function fileLog(note) {
    const m = G.m;
    if (!cap.db) return;
    const summary = logSummary();
    try {
      await cap.db.collection('rumors').add({
        callsign, uid: cap.uid || null, ts: Date.now(), title: m.title, type: m.type, place: m.place,
        cycle: m.kind === 'campaign' ? m.def.cycle : null, outcome: m.outcome, summary, note: String(note || '').slice(0, 280),
      });
      m.logged = 'yes';
    } catch (e) {
      m.logged = e && e.code === 'quota_exceeded' ? 'full' : e && e.code === 'invalid_argument' ? 'readonly' : 'error';
    }
    renderConsole();
  }
  function logSummary() {
    const m = G.m, f = (v) => m.mod.format(v);
    const parts = ['Flew ' + m.title + ' (' + m.place + ').'];
    if (m.solo) parts.push('Alone: ' + f(m.solo.value) + '.');
    parts.push('With NAV-7: ' + f(m.cen.value) + '.');
    parts.push('NAV-7 alone: ' + f(m.machine.value) + '.');
    parts.push(m.outcome === 'optimal' ? 'Matched the charted best.' : m.centaurWin ? 'Mind and machine beat the machine.' : 'The machine held this one.');
    return parts.join(' ');
  }

  // ------------------------------------------------------------ dialog
  function startDialog(nodes, onDone) {
    G.dlg = { queue: nodes.slice(), shown: [], choices: null, onDone, typing: null };
    advance();
  }
  function advance() {
    const d = G.dlg; if (!d) return;
    if (d.typing) { finishTyping(); return; }
    if (d.choices) return;
    const n = d.queue.shift();
    if (!n) { const cb = d.onDone; d.done = true; if (cb) cb(); renderConsole(); return; }
    if (n.choices) { d.choices = n.choices; renderConsole(); return; }
    d.shown.push({ who: n.who, text: n.text, vis: reduced ? n.text.length : 0 });
    d.typing = d.shown[d.shown.length - 1];
    renderConsole();
  }
  function skipDialog() {
    const d = G.dlg; if (!d) return;
    if (d.typing) { d.typing.vis = d.typing.text.length; d.typing = null; }
    while (d.queue.length && !d.queue[0].choices) { const n = d.queue.shift(); d.shown.push({ who: n.who, text: n.text, vis: n.text.length }); }
    advance();
  }
  function finishTyping() { const d = G.dlg; if (d && d.typing) { d.typing.vis = d.typing.text.length; d.typing = null; renderConsole(); } }
  function choose(c) {
    const d = G.dlg;
    d.shown.push({ who: 'you', text: c.text, vis: c.text.length });
    for (const k in c.rep || {}) prog.rep[k] = (prog.rep[k] || 0) + c.rep[k];
    saveProg(); renderStatus();
    d.choices = null;
    d.queue.unshift(...(c.then || []));
    Snd.click();
    advance();
  }

  // ------------------------------------------------------------ status bar
  function renderStatus() {
    const last = C.CAMPAIGN.filter((c) => prog.done[c.id]).map((c) => c.cycle).pop() || '77.4';
    const rep = prog.rep;
    $('#st-cycle').textContent = 'CYCLE ' + last;
    $('#st-rep').textContent = 'AUG ' + sgn(rep.aug) + ' · CON ' + sgn(rep.con) + ' · INQ ' + sgn(rep.inq) + ' · UNION ' + sgn(rep.union);
    $('#btn-sound').textContent = settings.sound ? 'SOUND ON' : 'SOUND OFF';
    $('#btn-sound').setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    $('#btn-crt').textContent = settings.crt ? 'CRT ON' : 'CRT OFF';
    $('#btn-crt').setAttribute('aria-pressed', settings.crt ? 'true' : 'false');
  }

  // ------------------------------------------------------------ console (HTML panel)
  function btn(label, onclick, cls, extra) {
    return h('button', Object.assign({ class: 'btn ' + (cls || ''), type: 'button', onclick: (e) => { Snd.init(); Snd.click(); onclick(e); } }, extra || {}), label);
  }
  function section(title, ...kids) { return h('section', { class: 'panel' }, title ? h('h2', { class: 'eyebrow' }, title) : null, ...kids); }
  function speakerLine(n) {
    const who = C.PEOPLE[n.who] || C.PEOPLE.sys;
    return h('div', { class: 'line who-' + who.color },
      h('span', { class: 'who' }, who.name), h('span', { class: 'said' }, n.vis != null ? n.text.slice(0, n.vis) : n.text));
  }
  function dialogBlock(opts) {
    const d = G.dlg;
    if (!d) return null;
    const log = h('div', { class: 'dialog', 'aria-live': 'polite' }, d.shown.map(speakerLine));
    const ctr = h('div', { class: 'row' });
    if (d.choices) {
      const list = h('div', { class: 'choices' }, d.choices.map((c, i) => btn((i + 1) + '. ' + c.text, () => choose(c), 'choice')));
      return h('div', {}, log, list);
    }
    if (!d.done) ctr.append(btn(d.typing ? 'Skip ▸' : 'Continue ▸', advance, 'primary', { id: 'btn-continue' }));
    if (opts && opts.skip && !d.done) ctr.append(btn('Skip to next choice', skipDialog, 'ghost'));
    return h('div', {}, log, ctr);
  }

  function renderConsole() {
    const root = $('#console');
    if (!root) return;
    const view = VIEWS[G.screen] ? VIEWS[G.screen]() : h('div');
    // A plan editor redraws on every change: put the focus back on the control that had it.
    const held = root.contains(document.activeElement) && document.activeElement.id;
    root.replaceChildren(view);
    const twin = held ? held.replace(/^eg-(add|drop)-/, (all, k) => 'eg-' + (k === 'add' ? 'drop' : 'add') + '-') : '';
    const back = held && held !== 'btn-continue' ? document.getElementById(held) || document.getElementById(twin) : null;
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    const cont = back ? null : document.getElementById('btn-continue');
    if (cont && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      try { cont.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    const dl = root.querySelector('.dialog'); if (dl) dl.scrollTop = dl.scrollHeight;
  }

  const VIEWS = {
    title() {
      const cs = h('input', { id: 'callsign', class: 'field', maxlength: '16', value: callsign, 'aria-label': 'Callsign', autocomplete: 'off', spellcheck: 'false' });
      cs.addEventListener('change', () => {
        const v = cs.value.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 16);
        if (v.length >= 2) { callsign = v; store.set('callsign', v); }
        cs.value = callsign;
      });
      const doneN = C.CAMPAIGN.filter((c) => prog.done[c.id]).length;
      return h('div', { class: 'stack' },
        section(null,
          h('p', { class: 'lede' }, 'Kestrel Nine is a game of minds and machines. Every job is flown three ways: by NAV-7 alone, by you alone, and by both of you together.'),
          h('p', { class: 'muted small' }, PUBLIC ? 'Your Records keep the tally on this device. Share a result card when you beat the machine.' : 'The Records keep the tally across every pilot.')),
        PUBLIC ? null : section('Callsign', h('label', { class: 'field-row', for: 'callsign' }, h('span', { class: 'muted small' }, 'Shown on the Records and Rumor Net'), cs)),
        SITE && install.update ? section('Update',
          h('p', { class: 'muted small' }, 'A new version of Kestrel Nine is ready. Your progress is kept.'),
          h('div', { class: 'row' }, btn('Reload to update', () => location.reload(), 'primary'))) : null,
        section('Fly',
          h('div', { class: 'menu' },
            btn('Campaign: Cold Start', () => go('campaign'), 'primary big', { 'data-sub': doneN + ' / ' + C.CAMPAIGN.length + ' missions' }),
            btn('Daily seed', () => go('daily'), 'big', { 'data-sub': utcDay() + ' UTC' }),
            btn('Arcade', () => go('arcade'), 'big', { 'data-sub': 'Pick a job and a size' }))),
        section('The reach',
          h('div', { class: 'menu two' },
            btn('Records', () => go('records')),
            PUBLIC ? null : btn('Rumor Net', () => go('rumors')),
            btn('Chronicle', () => go('chronicle')),
            btn('How to play', () => go('help')))),
        SITE && install.prompt ? section('Install',
          h('p', { class: 'muted small' }, 'Kestrel Nine installs as an app and plays offline.'),
          h('div', { class: 'row' }, btn('Install Kestrel Nine', doInstall, 'primary'))) : null,
        SITE && install.ios ? section('Install', h('p', { class: 'muted small' }, 'To install: Share, then Add to Home Screen.')) : null);
    },

    help() {
      return h('div', { class: 'stack' },
        section('How to play',
          h('p', {}, 'Each job has two runs on the same map.'),
          h('ol', { class: 'steps' },
            h('li', {}, h('b', {}, 'Solo. '), 'You plan alone. No engine help.'),
            h('li', {}, h('b', {}, 'Centaur. '), 'NAV-7 links in. Start from your solo plan or from scratch. You get three advisories (one suggested step each) and as many polish passes as you like. Under Statute 4.1, NAV-7 may refine a finished plan but may not originate one.'),
            h('li', {}, h('b', {}, 'Debrief. '), 'NAV-7’s own one-pass run is revealed next to yours, with the charted best.')),
          h('p', { class: 'muted small' }, 'Centaur Index: the share of runs where you and NAV-7 together beat NAV-7 alone and did at least as well as you did alone.')),
        section('The jobs', Object.keys(C.TYPE_INFO).map((k) => h('div', { class: 'kv' }, h('b', {}, C.TYPE_INFO[k].label), h('span', {}, C.TYPE_INFO[k].how)))),
        section('Controls', h('p', { class: 'small' }, 'Click or tap on the screen. Enter continues dialog. Ctrl+Z undoes.')),
        btn('◂ Back', () => go('title'), 'ghost'));
    },

    prologue() {
      return h('div', { class: 'stack' },
        h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Kestrel Nine'), h('h1', {}, 'Prologue')),
        section(null, dialogBlock()),
        h('div', { class: 'row' }, G.prologueReplay ? btn('◂ Back to the Chronicle', () => go('chronicle'), 'ghost') : btn('Skip prologue ▸', endPrologue, 'ghost')));
    },

    campaign() {
      const next = C.CAMPAIGN.findIndex((c) => !prog.done[c.id]);
      return h('div', { class: 'stack' },
        section('Campaign · Cold Start',
          h('p', { class: 'muted small' }, 'Six jobs in the Kestrel reach, Cycle 77.4 to 78.9. Replay any finished job to improve your mark.'),
          h('ol', { class: 'missions' }, C.CAMPAIGN.map((c, i) => {
            const done = prog.done[c.id];
            const locked = next >= 0 && i > next;
            return h('li', { class: 'mission' + (done ? ' done' : '') + (locked ? ' locked' : '') + (i === next ? ' next' : '') },
              h('div', { class: 'mission-head' },
                h('span', { class: 'num' }, String(c.num)),
                h('span', { class: 'mt' }, c.title),
                h('span', { class: 'tag' }, C.TYPE_INFO[c.type].label)),
              h('div', { class: 'mission-sub' }, c.place + ' · Cycle ' + c.cycle + (done ? ' · best ' + pctTxt(done.bestPct) : '')),
              locked ? h('span', { class: 'muted small' }, 'Locked') : btn(done ? 'Replay' : 'Fly', () => openMission(c), done ? 'ghost' : 'primary'));
          }))),
        btn('◂ Back', () => go('title'), 'ghost'));
    },

    brief() {
      const m = G.m;
      const d = G.dlg;
      const ready = d && d.done;
      return h('div', { class: 'stack' },
        h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, (m.kind === 'campaign' ? 'Mission ' + m.def.num + ' · ' : '') + C.TYPE_INFO[m.type].label), h('h1', {}, m.title), h('div', { class: 'muted small' }, m.place)),
        section(null, dialogBlock({ skip: true })),
        ready ? section('Objective', h('p', {}, m.objective), h('p', { class: 'muted small' }, C.TYPE_INFO[m.type].how)) : null,
        ready ? h('div', { class: 'row' }, btn('Begin solo run ▸', () => { go('play'); Snd.warp(); G.warp = 1; }, 'primary', { id: 'btn-continue' })) : null,
        h('div', { class: 'row' }, btn('◂ Abort', () => go(m.kind === 'campaign' ? 'campaign' : m.kind === 'daily' ? 'daily' : 'arcade'), 'ghost')));
    },

    play() {
      const m = G.m, mod = m.mod, info = C.TYPE_INFO[m.type];
      if (m.phase === 'link') {
        return h('div', { class: 'stack' },
          h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Solo run filed'), h('h1', {}, m.title),
            h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'YOUR SOLO'), h('span', { class: 'rv you' }, m.solo ? mod.format(m.solo.value) : 'skipped'))),
          section('NAV-7', h('div', { class: 'navlog' }, m.navLog.map((l) => h('p', {}, l)))),
          section('Centaur run', h('p', {}, info.centaur),
            h('div', { class: 'row' },
              m.solo ? btn('Start from my solo plan', () => beginCentaur(true), 'primary', { id: 'btn-continue' }) : null,
              btn('Start fresh', () => beginCentaur(false), m.solo ? '' : 'primary'))));
      }
      const ev = mod.evaluate(m.p, m.sol);
      const cen = m.phase === 'centaur';
      const readouts = [h('div', { class: 'readout' }, h('span', { class: 'rk' }, info.verb.toUpperCase()), h('span', { class: 'rv ' + (cen ? 'cen' : 'you') }, mod.format(ev.value)))];
      if (m.type === 'survey') readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'CREDITS'), h('span', { class: 'rv' }, E.TYPES.survey.spent(m.p, m.sol) + ' / ' + m.p.B)));
      if (m.type === 'blockade') readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'OPEN LANES'), h('span', { class: 'rv' + (ev.valid ? '' : ' warn') }, String(E.TYPES.blockade.uncovered(m.p, m.sol).length))));
      if (m.type === 'haul') readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'PORTS'), h('span', { class: 'rv' }, (m.sol.length - 1) + ' / ' + (m.p.n - 1))));
      if (m.type === 'treaty') readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'OF'), h('span', { class: 'rv' }, E.TYPES.treaty.total(m.p) + ' possible')));
      if (m.type === 'engagement') readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'OF'), h('span', { class: 'rv' }, mod.format(m.p.hull))));
      if (cen && m.solo) readouts.push(h('div', { class: 'readout' }, h('span', { class: 'rk' }, 'SOLO'), h('span', { class: 'rv you' }, mod.format(m.solo.value))));

      const tools = h('div', { class: 'tools' },
        btn('Undo', undo, 'ghost', { disabled: m.undo.length ? null : true }),
        m.type !== 'treaty' ? btn('Clear', clearSol, 'ghost') : null,
        cen ? btn('Advisory (' + m.adv + ')', doAdvisory, 'nav', { disabled: m.adv > 0 ? null : true }) : null,
        cen ? btn('Polish', doPolish, 'nav') : null,
        btn(cen ? 'File centaur plan ▸' : 'File solo plan ▸', submit, 'primary', { disabled: ev.valid ? null : true }));

      const kids = [
        h('header', { class: 'mhead' },
          h('div', { class: 'eyebrow ' + (cen ? 'cen' : 'you') }, cen ? 'Centaur run · you + NAV-7' : 'Solo run · no engine'),
          h('h1', {}, m.title)),
        h('div', { class: 'readouts' }, readouts),
        ev.note ? h('p', { class: 'note' }, ev.note) : null,
        tools,
      ];
      if (m.type === 'treaty') kids.push(treatyPanel(m));
      if (m.type === 'engagement') kids.push(engagementPanel(m));
      if (cen) kids.push(section('NAV-7', h('div', { class: 'navlog' }, m.navLog.map((l) => h('p', {}, l)))));
      kids.push(section('Objective', h('p', {}, m.objective), h('p', { class: 'muted small' }, info.how)));
      const foot = h('div', { class: 'row' });
      if (!cen) foot.append(btn('Skip to centaur run', skipSolo, 'ghost'));
      foot.append(btn('◂ Abort job', () => go(m.kind === 'campaign' ? 'campaign' : m.kind === 'daily' ? 'daily' : 'arcade'), 'ghost'));
      kids.push(foot);
      return h('div', { class: 'stack' }, kids);
    },

    debrief() {
      const m = G.m, mod = m.mod;
      if (!m.cen) return h('div');
      const row = (label, cls, val, pct, note) => h('tr', { class: cls },
        h('th', { scope: 'row' }, label), h('td', { class: 'num' }, val == null ? '—' : mod.format(val)), h('td', { class: 'num' }, pctTxt(pct)), h('td', { class: 'small muted' }, note || ''));
      const verdict = m.outcome === 'optimal' ? 'Charted best matched' : m.centaurWin ? 'Mind and machine beat the machine' : m.outcome === 'beat' ? 'You beat NAV-7' : 'NAV-7 held this map';
      const d = G.dlg;
      const kids = [
        h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Debrief · ' + C.TYPE_INFO[m.type].label), h('h1', {}, m.title), h('div', { class: 'verdict v-' + m.outcome }, verdict)),
        h('div', { class: 'table-wrap' }, h('table', { class: 'results' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Result'), h('th', { class: 'num' }, 'Of best'), h('th', {}, ''))),
          h('tbody', {},
            row('NAV-7 alone', 'r-nav', m.machine.value, m.pct.machine, 'one pass'),
            row('You alone', 'r-you', m.solo ? m.solo.value : null, m.pct.solo, m.solo ? '' : 'skipped'),
            row('You + NAV-7', 'r-cen', m.cen.value, m.pct.centaur, m.polishes + ' polish, ' + (3 - m.adv) + ' adv'),
            row('Charted best', 'r-best', m.charted.value, 100, m.charted.proven ? 'proven, ' + m.charted.work.toLocaleString('en-US') + ' states' : 'best known')))),
        h('p', { class: 'muted small' }, 'NAV-7’s procedure: ' + m.machine.procedure),
        h('div', { class: 'row layers', role: 'group', 'aria-label': 'Show on screen' },
          ['all', 'machine', 'solo', 'centaur', 'best'].map((k) => btn({ all: 'All', machine: 'NAV-7', solo: 'Solo', centaur: 'Centaur', best: 'Best' }[k], () => { G.layer = k; G.replayT = 0; renderConsole(); }, 'chip' + (G.layer === k ? ' on' : ''), { 'aria-pressed': G.layer === k ? 'true' : 'false' }))),
        section(null, dialogBlock()),
      ];
      if (d && d.done) {
        kids.push(sharePanel(m));
        if (!PUBLIC) kids.push(logPanel(m));
        const posted = PUBLIC ? 'Saved to your Records on this device.' : m.posted === 'yes' ? 'Posted to the Records.' : m.posted === 'kept' ? 'Your earlier mark on this map was better, so the Records keep it.' : m.posted === 'readonly' ? 'This view can read the Records but not post to them.' : m.posted === 'error' ? 'Could not reach the Records. Your run is saved on this device.' : cap.db ? '' : 'Records are kept on this device in this view.';
        if (posted) kids.push(h('p', { class: 'muted small' }, posted));
        const nextDef = m.kind === 'campaign' ? C.CAMPAIGN[m.def.num] : null;
        kids.push(h('div', { class: 'row' },
          nextDef ? btn('Next: ' + nextDef.title + ' ▸', () => openMission(nextDef), 'primary') : null,
          m.kind === 'campaign' && !nextDef ? btn('Read the Chronicle ▸', () => go('chronicle'), 'primary') : null,
          btn('Fly this map again', () => { const spec = Object.assign({}, m); delete spec.mod; startRun(spec); go('play'); }, nextDef ? 'ghost' : ''),
          prologueSeen() ? null : btn('Start at the beginning', () => openPrologue(false), 'ghost'),
          btn('◂ Menu', () => go(m.kind === 'campaign' ? 'campaign' : m.kind === 'daily' ? 'daily' : 'arcade'), 'ghost')));
      }
      return h('div', { class: 'stack' }, kids);
    },

    daily() {
      const day = utcDay();
      const runs = G.remote.runs;
      return h('div', { class: 'stack' },
        section('Daily seed · ' + day + ' UTC',
          h('p', { class: 'muted small' }, 'One map per job, the same for every pilot today. New maps at 00:00 UTC.'),
          h('div', { class: 'cards' }, Object.keys(E.TYPES).map((type) => {
            const key = 'd-' + day + '-' + type;
            const mine = prog.runs.filter((r) => r.seedKey === key).reduce((a, r) => Math.max(a, r.bestPct), 0);
            const board = runs ? runs.filter((r) => r.seedKey === key).sort((a, b) => b.bestPct - a.bestPct) : [];
            return h('div', { class: 'card' },
              h('div', { class: 'card-head' }, h('b', {}, C.TYPE_INFO[type].label), h('span', { class: 'muted small' }, mine ? 'your best ' + pctTxt(mine) : 'not flown')),
              board.length ? h('ol', { class: 'mini-board' }, board.slice(0, 3).map((r) => h('li', {}, h('span', {}, r.callsign || 'PILOT'), h('span', { class: 'num' }, pctTxt(r.bestPct))))) : null,
              btn(mine ? 'Fly again' : 'Fly', () => openRun(dailySpec(type)), mine ? 'ghost' : 'primary'));
          }))),
        btn('◂ Back', () => go('title'), 'ghost'));
    },

    arcade() {
      const typeSel = h('select', { id: 'ar-type', class: 'field' }, Object.keys(E.TYPES).map((t) => h('option', { value: t }, C.TYPE_INFO[t].label)));
      const sizeSel = h('select', { id: 'ar-size', class: 'field' }, ['S', 'M', 'L'].map((s) => h('option', { value: s, selected: s === 'M' ? true : null }, { S: 'Small', M: 'Medium', L: 'Large' }[s])));
      const code = h('input', { id: 'ar-code', class: 'field', placeholder: 'e.g. HAUL-M-7F3A', maxlength: '24', autocomplete: 'off', spellcheck: 'false' });
      const err = h('p', { class: 'note', hidden: true });
      return h('div', { class: 'stack' },
        section('Arcade',
          h('p', { class: 'muted small' }, 'Generate a fresh map, or enter a seed code to fly the same map as a friend.'),
          h('div', { class: 'form' },
            h('label', { for: 'ar-type' }, 'Job'), typeSel,
            h('label', { for: 'ar-size' }, 'Size'), sizeSel),
          h('div', { class: 'row' }, btn('Generate map ▸', () => {
            const c = Math.random().toString(36).slice(2, 6).toUpperCase();
            openRun(arcadeSpec(typeSel.value, sizeSel.value, c));
          }, 'primary'))),
        section('Seed code',
          h('div', { class: 'form' }, h('label', { for: 'ar-code' }, 'Code'), code), err,
          h('div', { class: 'row' }, btn('Fly this seed', () => {
            const mm = code.value.trim().toUpperCase().match(SEED_RE);
            if (!mm) { err.hidden = false; err.textContent = 'Seed codes look like HAUL-M-7F3A: job, size, then the code.'; return; }
            openRun(arcadeSpec(TYPE_OF[mm[1]], mm[2], mm[3]));
          }))),
        btn('◂ Back', () => go('title'), 'ghost'));
    },

    records() {
      const tabs = h('div', { class: 'row tabs', role: 'tablist' },
        [['index', 'Centaur Index'], ['today', 'Today'], ['mine', 'My runs']].map(([k, l]) => btn(l, () => { G.recordsTab = k; renderConsole(); }, 'chip' + (G.recordsTab === k ? ' on' : ''), { role: 'tab', 'aria-selected': G.recordsTab === k ? 'true' : 'false' })));
      let body;
      const shared = G.remote.runs;
      if (G.recordsTab === 'index') {
        const all = shared || prog.runs;
        body = indexPanel(all, shared ? 'All pilots' : 'This device');
      } else if (G.recordsTab === 'today') {
        const day = utcDay();
        if (!shared) body = section(null, h('p', { class: 'muted' }, PUBLIC ? 'This edition keeps no shared boards. Fly today\u2019s Daily seed, then share your result card: everyone gets the same maps.' : cap.dbTried ? 'Shared boards are not available in this view. Your own runs are under My runs.' : 'Connecting to the Records\u2026'));
        else body = h('div', { class: 'stack' }, Object.keys(E.TYPES).map((type) => {
          const key = 'd-' + day + '-' + type;
          const b = shared.filter((r) => r.seedKey === key).sort((a, c) => c.bestPct - a.bestPct).slice(0, 10);
          return section(C.TYPE_INFO[type].label + ' · ' + day,
            b.length ? boardTable(b) : h('p', { class: 'muted small' }, 'Nobody has flown today’s ' + C.TYPE_INFO[type].label.toLowerCase() + ' yet.'));
        }));
      } else {
        const mine = prog.runs.slice().reverse().slice(0, 30);
        body = section('Your last runs on this device', mine.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'board' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Job'), h('th', { class: 'num' }, 'Solo'), h('th', { class: 'num' }, '+NAV'), h('th', { class: 'num' }, 'NAV'))),
          h('tbody', {}, mine.map((r) => h('tr', {}, h('td', {}, r.title), h('td', { class: 'num' }, pctTxt(r.soloPct)), h('td', { class: 'num' }, pctTxt(r.centaurPct)), h('td', { class: 'num' }, pctTxt(r.machinePct))))))) :
          h('p', { class: 'muted' }, 'No runs yet. Fly a job and it will appear here.'));
      }
      return h('div', { class: 'stack' }, h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Records'), h('h1', {}, 'The tally')),
        SITE && G.pendingImport ? importPanel() : null, tabs, body, SITE ? savePanel() : null, btn('◂ Back', () => go('title'), 'ghost'));
    },

    rumors() {
      const list = G.remote.rumors;
      let body;
      if (!cap.db) body = h('p', { class: 'muted' }, cap.dbTried ? 'The Rumor Net is not reachable in this view.' : 'Listening…');
      else if (!list) body = h('p', { class: 'muted' }, 'Listening…');
      else if (!list.length) body = h('div', { class: 'empty' }, h('p', {}, 'No logs on the net yet.'), h('p', { class: 'muted small' }, 'Finish any job, write a line in your Ship’s Log, and file it. Yours will be the first thing the next pilot reads.'));
      else body = h('ol', { class: 'rumors' }, list.map((r) => h('li', { class: 'rumor' },
        h('div', { class: 'rumor-head' }, h('b', {}, r.callsign || 'UNKNOWN'), h('span', { class: 'muted small' }, (r.cycle ? 'Cycle ' + r.cycle + ' · ' : '') + (r.title || '') + ' · ' + new Date(r.ts || 0).toISOString().slice(0, 10))),
        r.note ? h('p', { class: 'rumor-note' }, r.note) : null,
        h('p', { class: 'muted small' }, r.summary || ''))));
      return h('div', { class: 'stack' },
        h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Rumor Net'), h('h1', {}, 'What pilots are saying'), h('p', { class: 'muted small' }, 'Unverified. The best of it becomes canon in the Chronicle.')),
        body, btn('◂ Back', () => go('title'), 'ghost'));
    },

    chronicle() {
      const list = !PUBLIC && G.remote.canon && G.remote.canon.length ? G.remote.canon : C.CANON;
      let body;
      if (!list) body = h('p', { class: 'muted' }, 'Opening the archive…');
      else if (!list.length) body = h('div', { class: 'empty' }, h('p', {}, 'The Chronicle is empty until the first canon review.'), h('p', { class: 'muted small' }, 'Canon grows from the Rumor Net: the best pilot logs are promoted here.'));
      else body = h('ol', { class: 'chronicle' }, list.map((c) => h('li', { class: 'canon' },
        h('div', { class: 'canon-when' }, c.cycle != null ? 'Cycle ' + c.cycle : (c.era || '')),
        h('div', {}, h('h3', {}, c.title || ''), h('p', {}, c.body || ''), c.source && c.source !== 'canon' ? h('p', { class: 'muted small' }, 'From the Rumor Net') : null))));
      return h('div', { class: 'stack' },
        h('header', { class: 'mhead' }, h('div', { class: 'eyebrow' }, 'Chronicle'), h('h1', {}, 'The history of the reach')),
        h('blockquote', { class: 'maxim' }, 'The machine is fast. The mind is wide. Neither is enough.', h('cite', {}, 'Ione Sato, Cycle 12')),
        body, h('div', { class: 'row' }, btn('Replay the prologue', () => openPrologue(true))), btn('◂ Back', () => go('title'), 'ghost'));
    },
  };

  function boardTable(rows) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'board' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Pilot'), h('th', { class: 'num' }, 'Solo'), h('th', { class: 'num' }, '+NAV'), h('th', { class: 'num' }, 'NAV'))),
      h('tbody', {}, rows.map((r) => h('tr', { class: r.uid && r.uid === cap.uid ? 'me' : '' },
        h('td', {}, r.callsign || 'PILOT'), h('td', { class: 'num' }, pctTxt(r.soloPct)), h('td', { class: 'num' }, pctTxt(r.centaurPct)), h('td', { class: 'num' }, pctTxt(r.machinePct)))))));
  }
  function indexPanel(all, scope) {
    const n = all.length;
    if (!n) return section('Centaur Index', h('p', { class: 'muted' }, 'No runs yet. Every job you fly adds to the tally.'));
    const wins = all.filter((r) => r.centaurWin).length;
    const avg = (k) => { const xs = all.map((r) => r[k]).filter((x) => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
    const idx = (wins / n) * 100;
    const bar = (label, v, cls) => {
      // Width through the CSSOM, not a style attribute, which the site edition's CSP blocks.
      const fill = h('span', { class: 'bar-fill ' + cls });
      fill.style.width = Math.max(0, Math.min(100, v || 0)).toFixed(1) + '%';
      return h('div', { class: 'bar-row' }, h('span', { class: 'bar-label' }, label), h('span', { class: 'bar' }, fill), h('span', { class: 'num' }, pctTxt(v)));
    };
    const byType = Object.keys(E.TYPES).map((t) => { const xs = all.filter((r) => r.type === t); return [t, xs.length, xs.filter((r) => r.centaurWin).length]; });
    return h('div', { class: 'stack' },
      section('Centaur Index · ' + scope,
        h('div', { class: 'big-stat' }, h('span', { class: 'big' }, idx.toFixed(0) + '%'), h('span', { class: 'muted small' }, wins + ' of ' + n + ' runs: you and NAV-7 together beat NAV-7 alone and matched or beat your solo plan.'))),
      section('Average share of the charted best', bar('NAV-7 alone', avg('machinePct'), 'nav'), bar('Pilot alone', avg('soloPct'), 'you'), bar('Pilot + NAV-7', avg('centaurPct'), 'cen')),
      section('By job', h('div', { class: 'table-wrap' }, h('table', { class: 'board' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Job'), h('th', { class: 'num' }, 'Runs'), h('th', { class: 'num' }, 'Index'))),
        h('tbody', {}, byType.map(([t, c, w]) => h('tr', {}, h('td', {}, C.TYPE_INFO[t].label), h('td', { class: 'num' }, String(c)), h('td', { class: 'num' }, c ? ((w / c) * 100).toFixed(0) + '%' : '—'))))))));
  }
  function shareText(m) {
    const blocks = (p) => { const n = p == null ? 0 : Math.max(0, Math.min(10, Math.floor(p / 10))); return '\u25b0'.repeat(n) + '\u25b1'.repeat(10 - n); };
    const label = C.TYPE_INFO[m.type].label;
    const head = m.kind === 'campaign' ? 'Mission ' + m.def.num + ': ' + m.title
      : m.kind === 'daily' ? 'Daily ' + label.charAt(0) + label.slice(1).toLowerCase() + ' \u00b7 ' + m.day
        : 'Arcade \u00b7 seed ' + m.code;
    const lines = [
      'KESTREL NINE \u00b7 ' + head,
      'NAV-7 ' + blocks(m.pct.machine) + ' ' + pctTxt(m.pct.machine),
      'Solo  ' + (m.solo ? blocks(m.pct.solo) + ' ' + pctTxt(m.pct.solo) : '(skipped)'),
      'Both  ' + blocks(m.pct.centaur) + ' ' + pctTxt(m.pct.centaur),
      'The machine is fast. The mind is wide.',
    ];
    if (C.SHARE_URL) lines.push(SITE && m.kind === 'arcade' ? C.SHARE_URL + '?c=' + encodeURIComponent(m.code) : C.SHARE_URL);
    return lines.join('\n');
  }
  function sharePanel(m) {
    const text = shareText(m), enc = encodeURIComponent(text);
    const card = h('pre', { class: 'sharecard', tabindex: '0', 'aria-label': 'Result card' }, text);
    const status = h('span', { class: 'muted small', 'aria-live': 'polite' });
    const copy = btn('Copy result', () => {
      const selectCard = () => { try { const r = document.createRange(); r.selectNodeContents(card); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ } status.textContent = 'Selected. Press Ctrl+C (or \u2318C) to copy.'; };
      try {
        const pr = navigator.clipboard && navigator.clipboard.writeText(text);
        if (pr) pr.then(() => { status.textContent = 'Copied. Paste it anywhere.'; }, selectCard); else selectCard();
      } catch (e) { selectCard(); }
    }, 'primary');
    // An icon alone has no name: the label is what a screen reader says and the tooltip shows.
    const ext = (icon, name, href) => h('a', { class: 'btn icon', href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Share on ' + name, title: 'Share on ' + name }, icon);
    const inst = h('input', { id: 'masto-inst', class: 'field', value: store.get('mastodon', ''), placeholder: 'mastodon.social', maxlength: '80', 'aria-label': 'Your Mastodon server', autocomplete: 'off', spellcheck: 'false' });
    const masto = ext('🐘', 'Mastodon', '#');
    const setM = () => {
      const host = (inst.value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase().replace(/[^a-z0-9.-]/g, '')) || 'mastodon.social';
      masto.href = 'https://' + host + '/share?text=' + enc;
    };
    inst.addEventListener('input', () => { setM(); store.set('mastodon', inst.value.trim()); });
    setM();
    return section('Share your result',
      card,
      h('div', { class: 'row' }, copy, status),
      h('div', { class: 'share-row' },
        h('label', { class: 'muted small', for: 'masto-inst' }, 'Your Mastodon server'), inst),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Share on a network' },
        masto, ext('🦋', 'Bluesky', 'https://bsky.app/intent/compose?text=' + enc), ext('𝕏', 'X', 'https://x.com/intent/post?text=' + enc)),
      h('p', { class: 'muted small' }, 'Mastodon, Bluesky and X. Each button opens a ready-to-send post in a new tab. Nothing is posted until you send it.'));
  }
  // ------------------------------------------------------------ save files (site edition, item 27)
  const saveSchema = () => ({
    campaigns: Object.fromEntries(C.CAMPAIGN.map((c) => [c.id, c.type])),
    typeDirs: Object.fromEntries(Object.keys(E.TYPES).map((t) => [t, E.TYPES[t].dir])),
    // Titles are rebuilt from the same specs the game flies, never read from the file.
    titleOf(kind, type, seedKey) {
      if (kind === 'campaign') return campaignSpec(C.CAMPAIGN.find((c) => c.id === seedKey)).title;
      if (kind === 'daily') return dailySpec(type).title;
      const [, , size, code] = seedKey.split('-');
      return arcadeSpec(type, size, code).title;
    },
  });
  function savePanel() {
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'save-file' });
    file.addEventListener('change', () => { const f = file.files && file.files[0]; if (f) readSave(f); });
    return section('Save file',
      h('p', { class: 'muted small' }, 'Your progress lives on this device. Export a save file to keep a backup or to move to another device. Importing restores missions, standings and records, never settings or callsign.'),
      h('div', { class: 'row' }, btn('Export save', exportSave), btn('Import save', () => file.click(), 'ghost'), file),
      G.saveMsg ? h('p', { class: 'muted small', role: 'status' }, G.saveMsg) : null);
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(window.K9Save.exportSave(prog), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'kestrel-nine-save.json', hidden: true });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    G.saveMsg = 'Save exported as kestrel-nine-save.json.';
    renderConsole();
  }
  function readSave(f) {
    G.pendingImport = null;
    if (f.size > window.K9Save.MAX_BYTES) { G.saveMsg = 'That file is too large to be a Kestrel Nine save.'; renderConsole(); return; }
    f.text().then((text) => {
      const r = window.K9Save.parseSave(text, saveSchema());
      if (r.ok) { G.pendingImport = r.progress; G.saveMsg = ''; } else G.saveMsg = r.error;
      renderConsole();
    }, () => { G.saveMsg = 'That file could not be read.'; renderConsole(); });
  }
  function importPanel() {
    const next = G.pendingImport;
    const missions = (d) => C.CAMPAIGN.filter((c) => d[c.id]).length + ' of ' + C.CAMPAIGN.length;
    const standing = (r) => ['aug', 'con', 'inq', 'union'].map((k) => k.toUpperCase() + ' ' + sgn(r[k] || 0)).join(' · ');
    const row = (label, now, after) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, now), h('td', {}, after));
    return section('Import this save?',
      h('div', { class: 'table-wrap' }, h('table', { class: 'board' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Now'), h('th', {}, 'After import'))),
        h('tbody', {},
          row('Missions', missions(prog.done), missions(next.done)),
          row('Records', String(prog.runs.length), String(next.runs.length)),
          row('Standing', standing(prog.rep), standing(next.rep))))),
      h('p', { class: 'muted small' }, 'Importing replaces the missions, standings and records on this device. Settings and callsign stay as they are.'),
      h('div', { class: 'row' },
        btn('Replace my progress', applyImport, 'primary'),
        btn('Cancel', () => { G.pendingImport = null; renderConsole(); }, 'ghost')));
  }
  function applyImport() {
    const next = G.pendingImport;
    if (!next) return;
    prog.done = next.done; prog.rep = next.rep; prog.runs = next.runs;
    if (next.prologue) prog.prologue = true; // an import never un-sees the prologue on this device
    G.pendingImport = null; G.saveMsg = 'Save imported.';
    saveProg(); renderStatus(); renderConsole();
  }

  function logPanel(m) {
    if (m.logged === 'yes') return section('Ship’s Log', h('p', {}, 'Filed to the Rumor Net.'), btn('Read the Rumor Net', () => go('rumors'), 'ghost'));
    const ta = h('textarea', { id: 'log-note', class: 'field', rows: '3', maxlength: '280', placeholder: 'What are you leaving for the next Augmented? A warning, a hint, a question.', 'aria-label': 'Ship’s Log note' });
    const status = m.logged === 'full' ? 'The Rumor Net is full. The next canon review will clear space.' : m.logged === 'readonly' ? 'This view can read the Rumor Net but not post to it.' : m.logged === 'error' ? 'The log did not send. Try again.' : '';
    return section('Ship’s Log',
      h('p', { class: 'muted small logsum' }, logSummary()), ta,
      status ? h('p', { class: 'note' }, status) : null,
      cap.db ? btn('File to the Rumor Net', () => fileLog(ta.value), 'primary') : h('p', { class: 'muted small' }, 'The Rumor Net is not reachable in this view.'));
  }
  // The fight's plan editor: the guns dial, the kill order, the enemy's parts and schedule, and
  // the fight as the plan would fly it. Tapping a part on the display does the same as Add.
  function engagementPanel(m) {
    const p = m.p, T = E.TYPES.engagement, X = C.ENGAGEMENT, sim = T.simulate(p, m.sol);
    const guns = T.guns(m.sol), order = T.order(m.sol);
    const part = (x) => (x.shots ? 'fires ' + x.dmg + ' at ' + T.ARCS[x.arc] + ' in round ' + x.shots.map((sh) => sh.round + 1).join(', ')
      : fill(X.parts[x.kind], x.kind === 'sensor' ? p.tracked : p.seized));
    const dial = section('Guns',
      h('div', { class: 'row' },
        btn('\u2212', () => setGuns(guns - 1), '', { id: 'eg-guns-down', 'aria-label': 'Less power to the guns', disabled: guns > 0 ? null : true }),
        h('div', { class: 'readout', role: 'status' }, h('span', { class: 'rk' }, 'POWER TO GUNS'), h('span', { class: 'rv' }, guns + ' of ' + p.P)),
        btn('+', () => setGuns(guns + 1), '', { id: 'eg-guns-up', 'aria-label': 'More power to the guns', disabled: guns < p.P ? null : true })),
      h('p', { class: 'muted small' }, X.dial));
    const listed = order.length ? h('ol', { class: 'aims' }, order.map((i, k) => h('li', { class: m.advNode === i ? 'adv' : '' },
      h('b', {}, p.subs[i].name),
      h('span', { class: 'row' },
        btn('▲', () => moveAim(i, -1), 'chip', { id: 'eg-up-' + i, 'aria-label': 'Darken ' + p.subs[i].name + ' earlier', disabled: k > 0 ? null : true }),
        btn('▼', () => moveAim(i, 1), 'chip', { id: 'eg-down-' + i, 'aria-label': 'Darken ' + p.subs[i].name + ' later', disabled: k < order.length - 1 ? null : true }),
        btn('Remove', () => aimAt(i), 'chip', { id: 'eg-drop-' + i, 'aria-label': 'Remove ' + p.subs[i].name + ' from the kill order' })))))
      : h('p', { class: 'muted small' }, X.none);
    const enemy = section(p.enemy, h('ul', { class: 'subs' }, p.subs.map((x, i) => h('li', { class: m.advNode === i ? 'adv' : '' },
      h('b', {}, x.name), h('span', { class: 'pips', 'aria-label': 'plating ' + x.thr }, '●'.repeat(x.thr)), h('span', { class: 'muted small' }, part(x)),
      order.includes(i) ? h('span', { class: 'place' }, '#' + (order.indexOf(i) + 1))
        : btn('Add', () => aimAt(i), 'chip', { id: 'eg-add-' + i, 'aria-label': 'Add ' + x.name + ' to the kill order' })))),
      h('p', { class: 'muted small' }, X.legend.replace('{s}', T.SHIELD)));
    const line = (row) => [
      row.fired.length ? 'guns ' + row.fired.map((f) => p.subs[f.tgt].name + ' ' + f.hit + (row.rem[f.tgt] <= 0 ? ' (dark)' : '')).join(', ') : 'guns idle',
      row.up.some(Boolean) ? 'shields ' + T.ARCS.filter((a, k) => row.up[k]).join(', ') : 'no shields',
      row.taken ? 'hull \u2212' + row.taken : 'no damage'].join(' · ');
    const end = [sim.rounds.length < p.R ? X.early : null, sim.seized ? fill(X.seized, p.seized) : null, sim.tracked ? fill(X.tracked, p.tracked) : null].filter(Boolean).join(' ');
    const log = section('The fight, as planned', h('ol', { class: 'rounds' }, sim.rounds.map((row) => h('li', {}, line(row)))),
      end ? h('p', { class: 'note' }, end) : null);
    return h('div', { class: 'stack' }, dial, section('Kill order', listed), enemy, log);
  }
  function treatyPanel(m) {
    const p = m.p, T = E.TYPES.treaty;
    const terms = h('div', { class: 'terms', role: 'group', 'aria-label': 'Treaty terms' }, p.terms.map((t, i) =>
      h('button', { class: 'term' + (m.sol[i] ? ' on' : '') + (m.advNode === i ? ' adv' : ''), type: 'button', role: 'switch', 'aria-checked': m.sol[i] ? 'true' : 'false', onclick: () => toggleTerm(i) },
        h('span', { class: 'switch', 'aria-hidden': 'true' }), h('span', {}, t))));
    const dels = p.delegates.map((d, di) => {
      const cls = p.clauses.filter((c) => c.who === di);
      const got = cls.filter((c) => T.sat(c, m.sol)).reduce((a, c) => a + c.w, 0), tot = cls.reduce((a, c) => a + c.w, 0);
      return h('details', { class: 'delegate', open: true },
        h('summary', {}, h('b', {}, d.name), h('span', { class: 'muted small' }, ' ' + d.faction + ' · ' + got + ' / ' + tot)),
        h('ul', { class: 'demands' }, cls.map((c) => h('li', { class: T.sat(c, m.sol) ? 'met' : 'unmet' },
          h('span', { class: 'lamp', 'aria-label': T.sat(c, m.sol) ? 'met' : 'not met' }), h('span', {}, T.demandText(p, c)), h('span', { class: 'pips', 'aria-label': 'weight ' + c.w }, '●'.repeat(c.w))))));
    });
    return h('div', { class: 'stack' }, section('Terms', terms), section('Delegates', dels));
  }

  // ------------------------------------------------------------ prologue (first launch, item 35)
  // A save with Mission 1 done counts as having seen it.
  const prologueSeen = () => prog.prologue === true || !!prog.done.c1;
  function markPrologue() { if (prog.prologue !== true) { prog.prologue = true; saveProg(); } }
  // A replay (from the Chronicle) never changes progress and returns to the Chronicle.
  function openPrologue(replay) {
    G.prologueReplay = !!replay;
    G.screen = 'prologue';
    startDialog(C.PROLOGUE, endPrologue);
    go('prologue');
  }
  function endPrologue() {
    if (G.prologueReplay) { go('chronicle'); return; }
    markPrologue();
    openMission(C.CAMPAIGN[0]);
  }

  function openMission(def) {
    startRun(campaignSpec(def));
    G.screen = 'brief';
    startDialog(def.brief, () => renderConsole());
    Snd.warp(); G.warp = 1;
    go('brief');
  }
  function openRun(spec) {
    startRun(spec);
    G.screen = 'brief';
    const intro = [{ who: 'sys', text: spec.place.toUpperCase() }, { who: 'nav', text: 'Job loaded: ' + spec.objective + ' This engine will stay unlinked until your solo plan is filed.' }];
    if (spec.type === 'engagement') {
      const p = G.m.p, rule = C.ENGAGEMENT.rules[p.doctrine];
      intro.splice(1, 0, { who: 'sys', text: fill(C.ENGAGEMENT.contact, p.enemy).replace('{r}', p.R) });
      if (rule) intro.push({ who: 'nav', text: rule });
    }
    startDialog(intro, () => renderConsole());
    Snd.warp(); G.warp = 1;
    go('brief');
  }

  // ------------------------------------------------------------ cutters (blockade ambience)
  function seedCutters() {
    const p = G.m.p;
    G.cutters = [];
    for (let i = 0; i < Math.min(5, Math.ceil(p.edges.length / 5)); i++) {
      const e = i * 7 % p.edges.length;
      G.cutters.push({ e, f: Math.random(), dir: 1, speed: 0.12 + Math.random() * 0.08, flash: 0 });
    }
  }
  function stepCutters(dt, sol) {
    const m = G.m; if (!m || m.type !== 'blockade') return;
    const p = m.p, on = new Set(sol);
    for (const c of G.cutters) {
      const [a, b] = p.edges[c.e];
      const covered = on.has(a) || on.has(b);
      c.f += c.dir * c.speed * dt * (covered ? 0.6 : 1);
      if (covered && c.f > 0.18 && c.f < 0.82 && !c.bounced) {
        c.dir *= -1; c.flash = 1; c.bounced = true;
        const [x1, y1] = [p.pts[a].x, p.pts[a].y], [x2, y2] = [p.pts[b].x, p.pts[b].y];
        G.sparks.push({ x: x1 + (x2 - x1) * c.f, y: y1 + (y2 - y1) * c.f, t: G.t });
      }
      if (c.f >= 1 || c.f <= 0) {
        const node = c.f >= 1 ? b : a;
        c.f = Math.max(0, Math.min(1, c.f));
        const opts = p.adj[node];
        const open = opts.filter(([u]) => !on.has(u) && !on.has(node));
        const [, k] = (open.length ? open : opts)[Math.floor(Math.random() * (open.length ? open.length : opts.length))];
        const [na] = p.edges[k];
        c.e = k; c.dir = na === node ? 1 : -1; c.f = na === node ? 0 : 1; c.bounced = false;
      }
      c.flash = Math.max(0, c.flash - dt * 2);
    }
  }

  // ------------------------------------------------------------ scene drawing
  const hitR = 24;
  function nodesOf(m) {
    if (m.type === 'haul' || m.type === 'blockade') return m.p.pts;
    if (m.type === 'survey') return m.p.sites;
    if (m.type === 'engagement') return engagementSpots(m.p);
    return [];
  }
  function hitTest(m, x, y) {
    const pts = nodesOf(m);
    const cssW = scr.out.getBoundingClientRect().width || 1000;
    let best = -1, bd = Math.max(hitR, 22 / (cssW / 1000));
    pts.forEach((q, i) => { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function hudText(ctx, m) {
    const cen = m.phase === 'centaur';
    const col = cen ? COL.cen : COL.you;
    R.vtext(ctx, m.title, 26, 24, 13, COL.text, 'left', 0.9);
    R.vtext(ctx, (m.phase === 'solo' ? 'SOLO · NO ENGINE' : m.phase === 'link' ? 'NAV-7 LINKING' : 'CENTAUR · YOU + NAV-7'), 26, 46, 9, col, 'left', 0.9);
    const ev = m.mod.evaluate(m.p, m.sol);
    R.vtext(ctx, m.mod.format(ev.value), 974, 24, 15, col, 'right');
    if (ev.note) R.vtext(ctx, ev.note, 974, 48, 9, COL.muted, 'right');
  }

  function drawHaul(ctx, p, t, layers, interactive) {
    const hz = p.hazard;
    if (hz) {
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = COL.inq; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, 6.2832); ctx.fill(); ctx.restore();
      R.circle(ctx, hz.x, hz.y, hz.r, COL.inq, 1.2, 0.55, [6, 6]);
      const a = t * 0.8;
      R.line(ctx, hz.x, hz.y, hz.x + Math.cos(a) * hz.r, hz.y + Math.sin(a) * hz.r, COL.inq, 1.2, 0.5);
      R.circle(ctx, hz.x, hz.y, hz.r * (0.3 + ((t * 0.25) % 0.7)), COL.inq, 0.8, 0.25);
      R.vtext(ctx, hz.label + ' ×' + hz.mult, hz.x, hz.y - hz.r - 14, 8, COL.inq, 'center', 0.85);
    }
    for (const L of layers) drawTour(ctx, p, L.sol, L.color, t, L);
    // hover preview
    const m = G.m;
    if (interactive && G.hover >= 0 && !m.sol.includes(G.hover)) {
      const a = p.pts[m.sol[m.sol.length - 1]], b = p.pts[G.hover];
      ctx.save(); ctx.setLineDash([4, 6]); R.line(ctx, a.x, a.y, b.x, b.y, layers[0].color, 1.2, 0.6); ctx.restore();
      R.vtext(ctx, E.round1(p.D[m.sol[m.sol.length - 1]][G.hover]).toFixed(1), (a.x + b.x) / 2, (a.y + b.y) / 2 - 12, 8, layers[0].color, 'center', 0.9);
    }
    const on = interactive ? new Set(m.sol) : new Set();
    p.pts.forEach((q, i) => {
      const visited = on.has(i);
      const c = i === 0 ? COL.text : visited ? layers[0].color : COL.text;
      R.station(ctx, q.x, q.y, t, c, { home: i === 0, alpha: visited || i === 0 || !interactive ? 1 : 0.8, phase: i });
      R.vtext(ctx, p.names[i], q.x, q.y + 17, 7.5, i === 0 ? COL.text : COL.muted, 'center', 0.9);
      if (interactive && visited && i !== 0) R.vtext(ctx, String(m.sol.indexOf(i)), q.x + 13, q.y - 16, 7, layers[0].color, 'center');
      if (interactive && G.hover === i) R.circle(ctx, q.x, q.y, 18, layers[0].color, 1, 0.6);
    });
    if (interactive && m.advNode >= 0) R.circle(ctx, p.pts[m.advNode].x, p.pts[m.advNode].y, 20 + Math.sin(t * 6) * 4, COL.nav, 1.6, 0.9);
  }
  function drawTour(ctx, p, sol, color, t, L) {
    if (!sol || sol.length < 1) return;
    const closed = sol.length === p.n;
    const seq = closed ? sol.concat([0]) : sol;
    const prog2 = L.progress == null ? 1 : L.progress; // 0..1 of the tour drawn (replay)
    const total = seq.length - 1;
    const upto = prog2 * total;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = L.lw || 2; ctx.globalAlpha = L.alpha == null ? 0.95 : L.alpha;
    if (L.dash) ctx.setLineDash(L.dash);
    ctx.beginPath();
    ctx.moveTo(p.pts[seq[0]].x + (L.off || 0), p.pts[seq[0]].y + (L.off || 0));
    let head = null, ang = 0;
    for (let k = 1; k <= total; k++) {
      const a = p.pts[seq[k - 1]], b = p.pts[seq[k]];
      const f = Math.min(1, Math.max(0, upto - (k - 1)));
      if (f <= 0) break;
      const x = a.x + (b.x - a.x) * f + (L.off || 0), y = a.y + (b.y - a.y) * f + (L.off || 0);
      ctx.lineTo(x, y);
      head = { x, y }; ang = Math.atan2(b.y - a.y, b.x - a.x);
    }
    ctx.stroke(); ctx.restore();
    if (L.ship && head && prog2 < 1) R.ship(ctx, head.x, head.y, ang, color, true, 0.9);
  }

  function drawSurvey(ctx, p, t, layers, interactive) {
    const m = G.m;
    const main = layers[0];
    const covered = new Set();
    for (const i of main.sol || []) for (const d of p.cover[i].list) covered.add(d);
    // reach circles
    for (const L of layers) {
      for (const i of L.sol || []) {
        const s = p.sites[i];
        ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = L.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); ctx.restore();
        R.circle(ctx, s.x, s.y, s.r + (L.off || 0), L.color, 1.3, 0.75, L.dash);
        for (let k = 0; k < 3; k++) { const a = t * 1.5 + k * 2.094; R.line(ctx, s.x, s.y, s.x + Math.cos(a) * 12, s.y + Math.sin(a) * 12, L.color, 1.2, 0.8); }
      }
    }
    if (interactive && G.hover >= 0 && !m.sol.includes(G.hover)) {
      const s = p.sites[G.hover];
      R.circle(ctx, s.x, s.y, s.r, main.color, 1, 0.55, [4, 5]);
    }
    // deposits
    p.deps.forEach((d, i) => {
      const lit = covered.has(i);
      const a = lit ? 1 : 0.38;
      if (d.ore === 0) { R.line(ctx, d.x - 3, d.y, d.x + 3, d.y, COL.iron, 1.2, a); R.line(ctx, d.x, d.y - 3, d.x, d.y + 3, COL.iron, 1.2, a); }
      else if (d.ore === 1) R.poly(ctx, d.x, d.y, 4.2, 4, 0, COL.cobalt, 1.3, a);
      else { const rr = 5 + (lit ? Math.sin(t * 5 + i) * 1.2 : 0); R.line(ctx, d.x - rr, d.y, d.x + rr, d.y, COL.lumen, 1.4, a); R.line(ctx, d.x, d.y - rr, d.x, d.y + rr, COL.lumen, 1.4, a); R.dot(ctx, d.x, d.y, 1.5, COL.lumen, a); }
    });
    // anchor rocks
    const on = new Set(main.sol || []);
    p.sites.forEach((s, i) => {
      const placed = on.has(i);
      R.rock(ctx, s.x, s.y, 6 + s.cost * 3.5, 'rk' + p.seed + i, t, placed ? main.color : COL.muted, placed ? 1 : 0.85);
      R.vtext(ctx, p.names[i].replace('ROCK ', ''), s.x, s.y - 23, 7, placed ? main.color : COL.muted, 'center', 0.9);
      R.vtext(ctx, s.cost + 'CR', s.x, s.y + 16, 6.5, COL.muted, 'center', 0.8);
      if (interactive && G.hover === i) R.circle(ctx, s.x, s.y, 20, main.color, 1, 0.7);
    });
    if (interactive && m.advNode >= 0) { const s = p.sites[m.advNode]; R.circle(ctx, s.x, s.y, 22 + Math.sin(t * 6) * 4, COL.nav, 1.6, 0.9); }
    // legend
    R.vtext(ctx, 'IRON 4T', 26, 600, 7, COL.iron, 'left', 0.9);
    R.vtext(ctx, 'COBALT 9T', 96, 600, 7, COL.cobalt, 'left', 0.9);
    R.vtext(ctx, 'LUMEN 22T', 184, 600, 7, COL.lumen, 'left', 0.9);
  }

  function drawBlockade(ctx, p, t, layers, interactive) {
    const main = layers[0];
    const on = new Set(main.sol || []);
    p.edges.forEach(([a, b], k) => {
      const A = p.pts[a], B = p.pts[b];
      if (on.has(a) || on.has(b)) R.staticLine(ctx, A, B, t + k, main.color, 0.55);
      else {
        R.line(ctx, A.x, A.y, B.x, B.y, COL.text, 1.4, 0.75);
        const f = (t * 0.35 + k * 0.137) % 1;
        R.dot(ctx, A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f, 2, COL.text, 0.9);
      }
    });
    for (let li = 1; li < layers.length; li++) {
      const L = layers[li];
      for (const i of L.sol || []) R.circle(ctx, p.pts[i].x, p.pts[i].y, 17 + li * 5, L.color, 1.3, 0.8, L.dash);
    }
    p.pts.forEach((q, i) => {
      const j = on.has(i);
      R.station(ctx, q.x, q.y, t, j ? main.color : COL.text, { phase: i, r: 8 + p.cost[i] * 1.5 });
      if (j) { const ph = (t * 0.9 + i * 0.3) % 1; R.circle(ctx, q.x, q.y, 14 + ph * 22, main.color, 1, 0.7 * (1 - ph)); }
      R.vtext(ctx, p.cost[i] + 'KC', q.x + 16, q.y - 15, 7, j ? main.color : COL.nav, 'left', 0.95);
      R.vtext(ctx, p.names[i], q.x, q.y + 20, 7, COL.muted, 'center', 0.85);
      if (interactive && G.hover === i) R.circle(ctx, q.x, q.y, 22, main.color, 1, 0.6);
    });
    const m = G.m;
    if (interactive && m.advNode >= 0) { const q = p.pts[m.advNode]; R.circle(ctx, q.x, q.y, 24 + Math.sin(t * 6) * 4, COL.nav, 1.6, 0.9); }
    // cutters
    if (interactive) {
      for (const c of G.cutters) {
        const [a, b] = p.edges[c.e], A = p.pts[a], B = p.pts[b];
        const x = A.x + (B.x - A.x) * c.f, y = A.y + (B.y - A.y) * c.f;
        const ang = Math.atan2(B.y - A.y, B.x - A.x) + (c.dir < 0 ? Math.PI : 0);
        R.ship(ctx, x, y, ang, COL.inq, false, 0.7);
      }
      G.sparks = G.sparks.filter((s) => G.t - s.t < 0.6);
      for (const s of G.sparks) { const k = (G.t - s.t) / 0.6; for (let i = 0; i < 6; i++) { const a = i * 1.047; R.line(ctx, s.x, s.y, s.x + Math.cos(a) * 14 * k, s.y + Math.sin(a) * 14 * k, COL.inq, 1.2, 1 - k); } }
      // threat clock
      const open = E.TYPES.blockade.uncovered(p, m.sol).length;
      const seg = Math.min(6, Math.ceil((open / p.edges.length) * 6));
      R.vtext(ctx, 'THREAT', 836, 590, 7, COL.inq, 'left', 0.9);
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.globalAlpha = i < seg ? 0.95 : 0.25; ctx.strokeStyle = COL.inq; ctx.lineWidth = 2; ctx.strokeRect(890 + i * 14, 584, 10, 10); if (i < seg) { ctx.fillStyle = COL.inq; ctx.globalAlpha = 0.5; ctx.fillRect(890 + i * 14, 584, 10, 10); } ctx.restore(); }
    }
  }

  const SEATS = [{ x: 500, y: 118 }, { x: 822, y: 318 }, { x: 500, y: 520 }, { x: 178, y: 318 }];
  function portrait(ctx, key, x, y, color, t) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    if (key === 'vey') { ctx.moveTo(x, y - 26); ctx.lineTo(x + 18, y + 16); ctx.lineTo(x - 18, y + 16); ctx.closePath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); }
    else if (key === 'pell') { ctx.rect(x - 12, y - 12, 24, 26); ctx.moveTo(x - 20, y - 12); ctx.lineTo(x + 20, y - 12); ctx.rect(x - 9, y - 26, 18, 14); ctx.moveTo(x - 5, y + 6); ctx.lineTo(x + 5, y + 6); }
    else if (key === 'rook') { ctx.arc(x, y + 2, 15, Math.PI, 0); ctx.lineTo(x + 17, y + 16); ctx.lineTo(x - 17, y + 16); ctx.closePath(); ctx.moveTo(x - 7, y + 8); ctx.lineTo(x + 7, y + 8); }
    else { ctx.rect(x - 10, y - 18, 20, 20); ctx.moveTo(x - 10, y + 2); ctx.lineTo(x - 18, y + 18); ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 18, y + 18); ctx.moveTo(x - 4, y - 9); ctx.lineTo(x + 4, y - 9); }
    ctx.stroke(); ctx.restore();
    if (key === 'rook') R.dot(ctx, x, y - 8, 2.4, COL.lumen, 0.7 + 0.3 * Math.sin(t * 4));
  }
  function drawTreaty(ctx, p, t, layers) {
    const main = layers[0], T = E.TYPES.treaty;
    const a = main.sol || [];
    ctx.save(); ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.2;
    for (const k of [1, 0.82]) { ctx.beginPath(); ctx.ellipse(500, 318, 250 * k, 150 * k, 0, 0, 6.2832); ctx.stroke(); }
    ctx.restore();
    // term ring
    const n = p.n;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2 + t * 0.05;
      const x1 = 500 + Math.cos(ang) * 150, y1 = 318 + Math.sin(ang) * 90;
      const x2 = 500 + Math.cos(ang) * 178, y2 = 318 + Math.sin(ang) * 107;
      R.line(ctx, x1, y1, x2, y2, a[i] ? main.color : COL.dim, a[i] ? 3 : 1.5, a[i] ? 1 : 0.8);
    }
    // seal
    const val = T.value(p, a), tot = T.total(p);
    R.poly(ctx, 500, 318, 58, 8, t * 0.2, main.color, 1.4, 0.8);
    R.poly(ctx, 500, 318, 44, 8, -t * 0.3, main.color, 1, 0.5);
    R.vtext(ctx, String(val), 500, 300, 22, main.color, 'center');
    R.vtext(ctx, 'OF ' + tot + ' ACCORD', 500, 332, 7.5, COL.muted, 'center');
    // seats
    p.delegates.forEach((d, di) => {
      const s = SEATS[di % 4];
      const cls = p.clauses.filter((c) => c.who === di);
      const got = cls.filter((c) => T.sat(c, a)).reduce((q, c) => q + c.w, 0), tot2 = cls.reduce((q, c) => q + c.w, 0);
      const f = tot2 ? got / tot2 : 0;
      portrait(ctx, d.key, s.x, s.y - 4, f > 0.66 ? main.color : f > 0.4 ? COL.text : COL.inq, t);
      R.circle(ctx, s.x, s.y - 2, 34, COL.dim, 1.2, 0.7);
      ctx.save(); ctx.strokeStyle = main.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(s.x, s.y - 2, 34, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); ctx.restore();
      R.vtext(ctx, d.name.replace(' (through you)', ''), s.x, s.y + 44, 8, COL.text, 'center', 0.9);
      R.vtext(ctx, got + '/' + tot2, s.x, s.y + 60, 7, COL.muted, 'center', 0.9);
    });
  }

  // Engagement: your ship at left inside its four shield arcs, the enemy at right. While a plan is
  // being written the screen shows the whole of it; at the debrief it replays, a round at a time.
  const ARC_DIR = [0, -Math.PI / 2, Math.PI / 2, Math.PI]; // fore faces the enemy, port is up-screen
  const SUB_SIDES = { mount: 3, sensor: 8, engine: 4, grapple: 5, drain: 5 };
  const BEAT = 1.5; // seconds a round stays on screen in a replay
  const ME = { x: 250, y: 320 }, FOE = { x: 730, y: 320 };
  function engagementSpots(p) {
    const mounts = p.subs.filter((x) => x.shots).length;
    let k = 0;
    return p.subs.map((x) => (x.shots ? { x: FOE.x - 100, y: FOE.y + (k++ - (mounts - 1) / 2) * 62 }
      : x.kind === 'sensor' ? { x: FOE.x + 20, y: FOE.y - 128 } : x.kind === 'engine' ? { x: FOE.x + 130, y: FOE.y } : { x: FOE.x + 20, y: FOE.y + 128 }));
  }
  function drawEngagement(ctx, p, t, layers, interactive) {
    const T = E.TYPES.engagement, me = ME, foe = FOE, AR = 62;
    const spots = engagementSpots(p);
    const arcAt = (a, rad) => ({ x: me.x + Math.cos(ARC_DIR[a]) * rad, y: me.y + Math.sin(ARC_DIR[a]) * rad });
    // which plan, and which moment of it
    let L = layers[0], beat = -1;
    if (G.screen === 'debrief') {
      const reel = layers.length > 1 ? ['NAV-7 ALONE', 'YOU ALONE', 'YOU + NAV-7'].map((n) => layers.find((x) => x.name === n)).filter(Boolean) : layers;
      const spans = reel.map((x) => T.simulate(p, x.sol).rounds.length + 2);
      let at = (G.replayT / BEAT) % spans.reduce((a, b) => a + b, 0);
      let i = 0;
      while (at >= spans[i]) at -= spans[i++];
      L = reel[i]; beat = Math.floor(at);
    }
    const sim = T.simulate(p, L.sol), n = sim.rounds.length, order = T.order(L.sol);
    const showing = beat >= 1 && beat <= n ? sim.rounds[beat - 1] : null; // the round on screen, in a replay
    const before = (r) => (r ? sim.rounds[r - 1].rem : p.subs.map((x) => x.thr));
    const rem = beat === 0 ? before(0) : showing ? showing.rem : before(n);
    // enemy hull
    const hull = [[-70, 0], [10, -84], [118, -44], [150, 0], [118, 44], [10, 84], [-70, 0]];
    hull.forEach((q, i) => { if (i) R.line(ctx, foe.x + hull[i - 1][0], foe.y + hull[i - 1][1], foe.x + q[0], foe.y + q[1], COL.inq, 1.2, 0.45); });
    R.vtext(ctx, p.enemy, foe.x + 30, foe.y - 178, 9, COL.inq, 'center', 0.9);
    // shots on the schedule: every live one while planning, this round's in a replay
    p.subs.forEach((x, i) => {
      if (!x.shots) return;
      const live = x.shots.filter((sh) => sh.round < n && before(sh.round)[i] > 0);
      const now = showing ? live.filter((sh) => sh.round === showing.r) : live;
      if (now.length) {
        const to = arcAt(x.arc, AR + 6), blocked = showing && showing.up[x.arc];
        ctx.save(); ctx.setLineDash([5, 6]); R.line(ctx, spots[i].x - 14, spots[i].y, to.x, to.y, COL.inq, showing ? 2 : 1.1, showing ? 0.95 : 0.4); ctx.restore();
        if (showing) R.vtext(ctx, (blocked ? 'BLOCKED · ' : '') + x.dmg, (spots[i].x + to.x) / 2, (spots[i].y + to.y) / 2 - 14, 8, COL.inq, 'center');
      }
      if (!showing) R.vtext(ctx, live.length ? 'R' + live.map((sh) => sh.round + 1).join(' ') + ' · ' + x.dmg : 'SILENCED', spots[i].x - 26, spots[i].y - 4, 7, live.length ? COL.inq : COL.muted, 'right', 0.95);
    });
    // your fire this round, in a replay
    if (showing) for (const f of showing.fired) R.line(ctx, me.x + 26, me.y, spots[f.tgt].x, spots[f.tgt].y, L.color, 2, 0.95);
    // subsystems, with their place in the kill order
    p.subs.forEach((x, i) => {
      const q = spots[i], dark = rem[i] <= 0, place = order.indexOf(i);
      R.poly(ctx, q.x, q.y, 13, SUB_SIDES[x.kind], x.shots ? Math.PI : t * 0.3, dark ? COL.dim : COL.text, 1.6, dark ? 0.8 : 1);
      R.vtext(ctx, x.name, q.x, q.y + 20, 7, dark ? COL.dim : COL.muted, 'center', 0.95);
      const went = sim.rounds.findIndex((row) => row.rem[i] <= 0);
      R.vtext(ctx, dark ? (beat < 0 && went >= 0 ? 'DARK R' + (went + 1) : 'DARK') : String(rem[i]), q.x + 22, q.y - 16, 8, dark ? L.color : COL.nav, 'left', 0.95);
      if (beat < 0 && place >= 0) { R.circle(ctx, q.x, q.y, 19, L.color, 1.4, 0.9); R.vtext(ctx, String(place + 1), q.x + 22, q.y + 2, 10, L.color, 'left'); }
      if (interactive && G.hover === i) R.circle(ctx, q.x, q.y, 23, L.color, 1, 0.6);
      if (interactive && G.m.advNode === i) R.circle(ctx, q.x, q.y, 25 + Math.sin(t * 6) * 4, COL.nav, 1.6, 0.9);
    });
    // your ship and its arcs
    R.ship(ctx, me.x, me.y, 0, L.color, !!showing, 2.4);
    T.ARCS.forEach((name, a) => {
      const count = sim.rounds.filter((row) => row.up[a]).length;
      const up = showing ? showing.up[a] : beat < 0 && count > 0;
      ctx.save(); ctx.strokeStyle = up ? L.color : COL.dim; ctx.lineWidth = up ? 3 : 1.4; ctx.globalAlpha = up ? 0.95 : 0.8;
      ctx.beginPath(); ctx.arc(me.x, me.y, AR, ARC_DIR[a] - 0.62, ARC_DIR[a] + 0.62); ctx.stroke(); ctx.restore();
      const q = arcAt(a, AR + 30);
      R.vtext(ctx, name + (beat < 0 && count ? ' ' + count + '/' + n : ''), q.x, q.y - 4, 7, up ? L.color : COL.muted, a === 0 ? 'left' : a === 3 ? 'right' : 'center', 0.9);
    });
    // captions: the replay's moment, or the plan's dial
    if (beat >= 0) {
      const taken = sim.rounds.slice(0, Math.min(beat, n)).reduce((a, row) => a + row.taken, 0);
      const done = beat > n;
      const cap = done ? 'JUMP' + (sim.seized ? ' · SEIZED' : '') + (sim.tracked ? ' · TRACKED' : '') : beat === 0 ? 'CONTACT' : 'ROUND ' + beat + ' OF ' + n;
      R.vtext(ctx, L.name + ' · ' + cap, 500, 70, 11, L.color, 'center');
      R.vtext(ctx, 'HULL ' + (done ? sim.value : p.hull - taken), me.x, me.y + AR + 60, 10, L.color, 'center');
    } else {
      R.vtext(ctx, 'GUNS ' + T.guns(L.sol) + '/' + p.P, me.x, me.y + AR + 60, 9, L.color, 'center', 0.9);
      if (interactive && (sim.tracked || sim.seized)) R.vtext(ctx, sim.seized ? 'SEIZED AT THE JUMP' : 'TRACKED AT THE JUMP', foe.x + 30, foe.y + 190, 8, COL.inq, 'center', 0.9);
    }
  }

  function drawPuzzle(ctx, m, t, layers, interactive) {
    if (m.type === 'haul') drawHaul(ctx, m.p, t, layers, interactive);
    else if (m.type === 'survey') drawSurvey(ctx, m.p, t, layers, interactive);
    else if (m.type === 'blockade') drawBlockade(ctx, m.p, t, layers, interactive);
    else if (m.type === 'engagement') drawEngagement(ctx, m.p, t, layers, interactive);
    else drawTreaty(ctx, m.p, t, layers);
  }

  // reach map for campaign
  const REACH = {
    'Relay ring': { x: 380, y: 300 }, 'Halden’s Reach': { x: 250, y: 470 }, 'The Bazaar lanes': { x: 560, y: 180 },
    'Vesper approaches': { x: 700, y: 360 }, 'Tollgate': { x: 470, y: 520 }, 'The Quiet': { x: 900, y: 170 },
  };
  function drawCampaign(ctx, t) {
    R.stars(ctx, t, 2);
    R.planet(ctx, 500, 318, 70, t, { alpha: 0.55 });
    // quiet fog
    for (let i = 0; i < 5; i++) R.circle(ctx, 960, 150, 60 + i * 30 + Math.sin(t + i) * 4, COL.inq, 1, 0.12);
    const next = C.CAMPAIGN.findIndex((c) => !prog.done[c.id]);
    let prev = null;
    C.CAMPAIGN.forEach((c, i) => {
      const q = REACH[c.place];
      if (prev) { ctx.save(); ctx.setLineDash([3, 7]); R.line(ctx, prev.x, prev.y, q.x, q.y, COL.dim, 1, 0.8); ctx.restore(); }
      prev = q;
      const done = prog.done[c.id];
      const col = done ? COL.cen : i === next ? COL.you : COL.dim;
      R.station(ctx, q.x, q.y, t, col, { r: 10, home: i === next, phase: i });
      R.vtext(ctx, c.num + ' ' + c.title, q.x, q.y + 22, 8, col, 'center');
    });
    if (next < 0) { R.station(ctx, 930, 520, t, COL.cen, { r: 12, home: true }); R.vtext(ctx, 'THE LANTERN', 930, 548, 9, COL.cen, 'center'); }
    R.vtext(ctx, 'THE KESTREL REACH', 26, 24, 13, COL.text);
    R.vtext(ctx, 'CAMPAIGN · COLD START', 26, 46, 9, COL.muted);
  }

  // Dark. Then a cursor.
  function drawPrologue(ctx, t) {
    ctx.save(); ctx.globalAlpha = 0.3; R.stars(ctx, t, 0.6, 0); ctx.restore();
    if (reduced || Math.floor(t * 1.6) % 2 === 0) R.vtext(ctx, '_', 72, 300, 30, COL.you, 'left');
  }

  function drawTitle(ctx, t) {
    R.stars(ctx, t, 3, G.warp > 0.05 ? G.warp * 3 : 0);
    R.planet(ctx, 690, 330, 150, t, { alpha: 0.85, color: COL.muted, ringColor: COL.you });
    // orbiting station
    const a = t * 0.25;
    R.station(ctx, 690 + Math.cos(a) * 330, 330 + Math.sin(a) * 120, t, COL.text, { r: 6 });
    R.vtext(ctx, 'KESTREL', 70, 180, 58, COL.text, 'left');
    R.vtext(ctx, 'NINE', 70, 256, 58, COL.you, 'left');
    R.vtext(ctx, 'A GAME OF MINDS AND MACHINES', 72, 346, 11, COL.muted, 'left');
    R.vtext(ctx, 'THE MACHINE IS FAST.', 72, 420, 9, COL.nav, 'left', 0.9);
    R.vtext(ctx, 'THE MIND IS WIDE.', 72, 440, 9, COL.you, 'left', 0.9);
    R.vtext(ctx, 'NEITHER IS ENOUGH.', 72, 460, 9, COL.cen, 'left', 0.9);
    if (Math.floor(t * 1.6) % 2 === 0) R.vtext(ctx, 'CHOOSE FROM THE CONSOLE', 72, 560, 9, COL.text, 'left', 0.8);
  }

  function drawDebriefOverlay(ctx, m, t) {
    // bars panel
    const rows = [['NAV-7', m.pct.machine, COL.nav], ['SOLO', m.pct.solo, COL.you], ['CENTAUR', m.pct.centaur, COL.cen], ['CHARTED', 100, COL.best]];
    const x0 = 26, y0 = 500, w = 230, grow = Math.min(1, G.replayT / 1.5);
    const fade = G.replayT < 6 ? 1 : Math.max(0, 1 - (G.replayT - 6));
    if (fade <= 0) return;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.save(); ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = COL.bg; ctx.fillRect(x0 - 10, y0 - 22, w + 110, 116); ctx.restore();
    R.vtext(ctx, 'SHARE OF CHARTED BEST', x0, y0 - 12, 7, COL.muted, 'left');
    rows.forEach(([lab, v, col], i) => {
      const y = y0 + 4 + i * 20;
      R.vtext(ctx, lab, x0, y, 7.5, col, 'left');
      const L = v == null ? 0 : (v / 100) * w * grow;
      R.line(ctx, x0 + 72, y + 4, x0 + 72 + w, y + 4, COL.dim, 1, 0.8);
      if (v != null) R.line(ctx, x0 + 72, y + 4, x0 + 72 + L - 60 * 0, y + 4, col, 4, 0.95);
      R.vtext(ctx, v == null ? '--' : pctTxt(v).replace('%', ''), x0 + 72 + w + 10, y, 7.5, col, 'left', fade);
    });
    ctx.restore();
  }

  function layersForDebrief(m) {
    const L = [];
    const names = { centaur: 'YOU + NAV-7', solo: 'YOU ALONE', machine: 'NAV-7 ALONE', best: 'CHARTED BEST' };
    const add = (k, sol, color, extra) => { if (sol && (G.layer === 'all' || G.layer === k)) L.push(Object.assign({ sol, color, name: names[k] }, extra || {})); };
    const prog2 = Math.min(1, (G.replayT % 7) / 5);
    add('centaur', m.cen.solution, COL.cen, { ship: true, progress: prog2, lw: 2.2 });
    add('solo', m.solo && m.solo.solution, COL.you, { ship: true, progress: prog2, off: 3, lw: 1.6, alpha: 0.85 });
    add('machine', m.machine.solution, COL.nav, { ship: true, progress: prog2, off: -3, lw: 1.6, alpha: 0.85, dash: m.type === 'haul' ? null : [5, 4] });
    add('best', m.charted.solution, COL.best, { progress: 1, lw: 1, alpha: 0.5, dash: [2, 5] });
    if (!L.length) L.push({ sol: m.cen.solution, color: COL.cen, name: names.centaur });
    return L;
  }

  function frame(now) {
    const rawDt = Math.max(0, (now - (G.last || now)) / 1000);
    const dt = Math.min(0.05, rawDt);
    G.last = now;
    G.t += reduced ? dt * 0.35 : dt;
    G.replayT += dt;
    G.warp = Math.max(0, G.warp - dt * 1.4);
    scr.resize();
    { const cw = scr.out.getBoundingClientRect().width || 1000; R.setTextBoost(Math.max(1, Math.min(1.6, 640 / cw))); }
    const ctx = scr.begin(G.clearNext ? 0 : Math.pow(0.58, Math.min(rawDt, 0.25) * 60));
    G.clearNext = false;
    const t = G.t;
    const m = G.m;
    if (G.screen === 'title' || G.screen === 'help') drawTitle(ctx, t);
    else if (G.screen === 'prologue') drawPrologue(ctx, t);
    else if (G.screen === 'campaign') drawCampaign(ctx, t);
    else if (['daily', 'arcade', 'records', 'rumors', 'chronicle'].includes(G.screen)) {
      R.stars(ctx, t, 2, G.warp * 2); R.planet(ctx, 820, 470, 110, t, { alpha: 0.5 });
      const title = { daily: 'DAILY SEED', arcade: 'ARCADE', records: 'THE RECORDS', rumors: 'RUMOR NET', chronicle: 'CHRONICLE' }[G.screen];
      R.vtext(ctx, title, 60, 110, 34, COL.text);
      if (G.screen === 'records') {
        const all = G.remote.runs || prog.runs;
        if (all.length) {
          const idx = (all.filter((r) => r.centaurWin).length / all.length) * 100;
          R.vtext(ctx, 'CENTAUR INDEX', 60, 190, 10, COL.muted);
          R.vtext(ctx, idx.toFixed(0) + '%', 60, 216, 48, COL.cen);
          R.vtext(ctx, all.length + ' RUNS', 60, 300, 9, COL.muted);
        }
      } else if (G.screen === 'chronicle') {
        R.vtext(ctx, 'THE MACHINE IS FAST.', 60, 200, 11, COL.nav); R.vtext(ctx, 'THE MIND IS WIDE.', 60, 224, 11, COL.you); R.vtext(ctx, 'NEITHER IS ENOUGH.', 60, 248, 11, COL.cen);
      } else if (G.screen === 'daily') {
        R.vtext(ctx, utcDay() + ' UTC', 60, 170, 12, COL.muted);
      }
    } else if (m && (G.screen === 'brief' || G.screen === 'play' || G.screen === 'debrief')) {
      R.stars(ctx, t, 1.2, G.warp * 2);
      if (G.screen === 'brief') {
        drawPuzzle(ctx, m, t, [{ sol: m.mod.empty(m.p), color: COL.you }], false);
        ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, 1000, 625); ctx.restore();
        R.vtext(ctx, (m.kind === 'campaign' ? 'MISSION ' + m.def.num : C.TYPE_INFO[m.type].label), 500, 250, 12, COL.muted, 'center');
        R.vtext(ctx, m.title, 500, 280, 30, COL.text, 'center');
        R.vtext(ctx, m.place, 500, 330, 10, COL.you, 'center');
      } else if (G.screen === 'debrief' && m.cen) {
        drawPuzzle(ctx, m, t, layersForDebrief(m), false);
        drawDebriefOverlay(ctx, m, t);
        R.vtext(ctx, 'DEBRIEF · ' + m.title, 26, 24, 13, COL.text);
      } else {
        const col = m.phase === 'centaur' ? COL.cen : COL.you;
        const layers = [{ sol: m.sol, color: col }];
        if (m.phase === 'centaur' && m.solo && m.type === 'haul') layers.push({ sol: m.solo.solution, color: COL.you, alpha: 0.2, lw: 1, dash: [3, 6] });
        if (m.phase === 'link' && m.solo) layers[0] = { sol: m.solo.solution, color: COL.you };
        stepCutters(dt, m.sol);
        drawPuzzle(ctx, m, t, layers, m.phase !== 'link');
        hudText(ctx, m);
      }
    }
    if (G.toast && G.t - G.toast.t < 2.2) {
      const a = Math.min(1, 2.2 - (G.t - G.toast.t));
      ctx.save(); ctx.globalAlpha = 0.85 * a; ctx.fillStyle = COL.bg; const tw = R.textWidth(G.toast.msg, 10) + 36; ctx.fillRect(500 - tw / 2, 560, tw, 34); ctx.restore();
      R.vtext(ctx, G.toast.msg, 500, 572, 10, G.toast.color, 'center', a);
    }
    scr.present(G.t);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ input
  const canvasEl = () => scr.out;
  function onMove(ev) {
    if (G.screen !== 'play' || !G.m || G.m.phase === 'link' || G.m.type === 'treaty') { G.hover = -1; return; }
    const w = scr.toWorld(ev);
    G.hover = hitTest(G.m, w.x, w.y);
    canvasEl().style.cursor = G.hover >= 0 ? 'pointer' : 'default';
  }
  function onDown(ev) {
    Snd.init();
    if (G.screen === 'play' && G.m && G.m.phase !== 'link' && G.m.type !== 'treaty') {
      const w = scr.toWorld(ev);
      const i = hitTest(G.m, w.x, w.y);
      if (i >= 0) clickNode(i);
    } else if (G.screen === 'campaign') {
      const w = scr.toWorld(ev);
      const next = C.CAMPAIGN.findIndex((c) => !prog.done[c.id]);
      C.CAMPAIGN.forEach((c, i) => {
        const q = REACH[c.place];
        if (Math.hypot(q.x - w.x, q.y - w.y) < 26 && (next < 0 || i <= next)) openMission(c);
      });
    } else if (DIALOG_SCREENS.includes(G.screen)) {
      if (G.dlg && !G.dlg.done && !G.dlg.choices) advance();
    }
  }
  function bindCanvas() {
    const el = canvasEl();
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerleave', () => { G.hover = -1; });
  }
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && G.screen === 'play') { e.preventDefault(); undo(); return; }
    if (G.dlg && !G.dlg.done && DIALOG_SCREENS.includes(G.screen)) {
      if (G.dlg.choices && /^[1-9]$/.test(e.key)) { const c = G.dlg.choices[+e.key - 1]; if (c) { e.preventDefault(); choose(c); } }
    }
  });

  // typewriter
  setInterval(() => {
    const d = G.dlg;
    if (!d || !d.typing) return;
    d.typing.vis = Math.min(d.typing.text.length, d.typing.vis + 3);
    const el = document.querySelector('#console .dialog .line:last-child .said');
    if (el) el.textContent = d.typing.text.slice(0, d.typing.vis);
    if (d.typing.vis % 9 === 0) Snd.type();
    if (d.typing.vis >= d.typing.text.length) { d.typing = null; renderConsole(); }
  }, 16);

  $('#btn-sound').addEventListener('click', () => { Snd.init(); settings.sound = !settings.sound; store.set('settings', settings); renderStatus(); });
  $('#btn-crt').addEventListener('click', () => { settings.crt = !settings.crt; scr.fx = settings.crt; store.set('settings', settings); renderStatus(); });
  // Leaving the first-launch prologue for the title screen counts as skipping it.
  $('#btn-home').addEventListener('click', () => { if (G.screen === 'prologue' && !G.prologueReplay) markPrologue(); go('title'); });

  // live-reload friendliness: keep the viewer's place across republishes
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ screen: ['title', 'campaign', 'daily', 'arcade', 'records', 'rumors', 'chronicle', 'help'].includes(G.screen) ? G.screen : 'title' })); } catch (e) { /* optional */ } }
  // ?c=HAUL-M-7F3A opens that arcade seed. Anything that fails the seed-code pattern is ignored.
  function challengeFromUrl() {
    if (!SITE) return null;
    let c = null;
    try { c = new URLSearchParams(location.search).get('c'); } catch (e) { return null; }
    if (c == null) return null;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* keep the query */ }
    const mm = c.trim().toUpperCase().match(SEED_RE);
    return mm ? arcadeSpec(TYPE_OF[mm[1]], mm[2], mm[3]) : null;
  }
  function start(data) {
    bindCanvas();
    renderStatus();
    const challenge = challengeFromUrl();
    if (challenge) openRun(challenge);
    else if (!prologueSeen()) openPrologue(false);
    else go((data && data.screen) || 'title');
    requestAnimationFrame(frame);
  }
  if (hot && typeof hot.ready === 'function') { try { hot.ready(start); } catch (e) { start({}); } }
  else start((hot && hot.data) || {});
})();
