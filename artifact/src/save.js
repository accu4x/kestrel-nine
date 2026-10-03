/* Kestrel Nine: save file export and import (OPEN-ITEMS item 27).
 * Runs in the browser (window.K9Save) and in Node (module.exports) for tests.
 *
 * Contract for parseSave: a save restores progress and records, never settings, callsign or
 * page content. It checks everything before anything is touched and returns either
 * { ok: true, progress } or { ok: false, error }. Errors are fixed strings and never echo the
 * file. `progress.prologue` is an optional boolean (item 35); saves without it stay valid. Unknown keys at the top level, in `progress`, in `done` (not a campaign id) and in
 * `rep` reject the file; unknown fields inside a run or a `done` entry are dropped.
 * What travels is IDs and numbers, never free text (item 27): export leaves run titles out, and
 * import rebuilds each title from the validated kind, type and seed key through schema.titleOf.
 */
(function (root) {
  'use strict';
  const APP = 'kestrel-nine';
  const V = 1;
  const MAX_BYTES = 256 * 1024;
  const MAX_RUNS = 300;
  const REP_KEYS = ['aug', 'con', 'inq', 'union'];
  const REP_MIN = -50, REP_MAX = 50;
  const OUTCOMES = ['optimal', 'beat', 'lost'];
  const KINDS = ['campaign', 'daily', 'arcade'];
  const MIN_TS = Date.UTC(2026, 0, 1);
  const MAX_VALUE = 1e6;

  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const own = (o) => Object.keys(o);
  const onlyKeys = (o, allowed) => own(o).every((k) => allowed.includes(k));
  const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  const numOrNull = (x, lo, hi) => x === null || num(x, lo, hi);
  const byteLength = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length * 3);

  function exportSave(prog, now) {
    // JSON drops `prologue` while it is unset, so older and newer saves share one shape.
    return {
      app: APP, v: V, exported: (now || new Date()).toISOString(),
      progress: JSON.parse(JSON.stringify({
        done: prog.done || {}, rep: prog.rep || {},
        runs: (prog.runs || []).map((r) => { const c = Object.assign({}, r); delete c.title; return c; }),
        prologue: prog.prologue,
      })),
    };
  }

  // One run as runRecord() in game.js writes it. Returns the cleaned run, or null.
  function cleanRun(r, schema, now) {
    if (!isObj(r)) return null;
    if (!own(schema.typeDirs).includes(r.type) || r.dir !== schema.typeDirs[r.type] || !KINDS.includes(r.kind)) return null;
    // Every key format is bound to this run's own type, so a record cannot count under another job.
    if (typeof r.seedKey !== 'string') return null;
    const keyOk = r.kind === 'campaign' ? own(schema.campaigns).includes(r.seedKey) && schema.campaigns[r.seedKey] === r.type
      : r.kind === 'daily' ? new RegExp('^d-\\d{4}-\\d{2}-\\d{2}-' + r.type + '$').test(r.seedKey)
        : new RegExp('^a-' + r.type + '-[SML]-[A-Z0-9]{1,8}(\\+[a-z]+(\\.[a-z]+)*)?$').test(r.seedKey);
    if (!keyOk) return null;
    // A refit run's key ends in its loadout: known modules that fit the job, sorted, no repeats.
    const fit = r.kind === 'arcade' && r.seedKey.includes('+') ? r.seedKey.split('+')[1].split('.') : [];
    const jobs = schema.modules || {};
    if (fit.length > (schema.slots || 0) || !fit.every((id, i) => own(jobs).includes(id) && (jobs[id] === r.type || jobs[id] === 'all') && (i === 0 || fit[i - 1] < id))) return null;
    const title = schema.titleOf(r.kind, r.type, r.seedKey);
    if (typeof title !== 'string') return null;
    if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return null;
    if (!num(r.machine, 0, MAX_VALUE) || !numOrNull(r.solo, 0, MAX_VALUE) || !num(r.centaur, 0, MAX_VALUE) || !num(r.best, 0, MAX_VALUE)) return null;
    if (!num(r.machinePct, 0, 100) || !numOrNull(r.soloPct, 0, 100) || !num(r.centaurPct, 0, 100) || !num(r.bestPct, 0, 100)) return null;
    if (typeof r.bestProven !== 'boolean' || typeof r.centaurWin !== 'boolean') return null;
    if (!int(r.polishes, 0, 10000) || !int(r.advisoriesUsed, 0, fit.includes('second') ? 4 : 3)) return null;
    if (!int(r.ts, MIN_TS, now + 2 * 86400000)) return null;
    return {
      seedKey: r.seedKey, kind: r.kind, type: r.type, title, day: r.day, dir: r.dir,
      machine: r.machine, solo: r.solo, centaur: r.centaur, best: r.best, bestProven: r.bestProven,
      machinePct: r.machinePct, soloPct: r.soloPct, centaurPct: r.centaurPct, bestPct: r.bestPct,
      centaurWin: r.centaurWin, polishes: r.polishes, advisoriesUsed: r.advisoriesUsed, ts: r.ts,
    };
  }

  // schema: { campaigns: { c1: 'haul', ... }, typeDirs: { haul: 'min', ... },
  //          modules: { light: 'survey', second: 'all', ... }, slots: 3,
  //          titleOf(kind, type, seedKey) -> the game's own display title for a validated run }
  function parseSave(text, schema, now) {
    const fail = (error) => ({ ok: false, error });
    const t = now == null ? Date.now() : now;
    if (typeof text !== 'string') return fail('That file could not be read.');
    if (byteLength(text) > MAX_BYTES) return fail('That file is too large to be a Kestrel Nine save.');
    let data;
    try { data = JSON.parse(text); } catch (e) { return fail('That file is not a Kestrel Nine save.'); }
    if (!isObj(data) || data.app !== APP) return fail('That file is not a Kestrel Nine save.');
    if (data.v !== V) return fail('That save comes from a different version of the game.');
    if (!onlyKeys(data, ['app', 'v', 'exported', 'progress'])) return fail('That save has fields this game does not know.');
    if (data.exported !== undefined && (typeof data.exported !== 'string' || data.exported.length > 40)) return fail('That save has a bad export date.');
    const p = data.progress;
    if (!isObj(p) || !onlyKeys(p, ['done', 'rep', 'runs', 'prologue'])) return fail('That save has fields this game does not know.');
    if (p.prologue !== undefined && typeof p.prologue !== 'boolean') return fail('That save’s prologue flag is damaged.');

    const done = {};
    if (p.done !== undefined) {
      if (!isObj(p.done)) return fail('That save’s campaign progress is damaged.');
      for (const id of own(p.done)) {
        const d = p.done[id];
        if (!own(schema.campaigns).includes(id)) return fail('That save names a mission this game does not have.');
        if (!isObj(d) || !num(d.bestPct, 0, 100) || !OUTCOMES.includes(d.outcome)) return fail('That save’s campaign progress is damaged.');
        done[id] = { bestPct: d.bestPct, outcome: d.outcome };
      }
    }

    const rep = { aug: 0, con: 0, inq: 0, union: 0 };
    if (p.rep !== undefined) {
      if (!isObj(p.rep) || !onlyKeys(p.rep, REP_KEYS)) return fail('That save’s standings are damaged.');
      for (const k of own(p.rep)) {
        if (!int(p.rep[k], REP_MIN, REP_MAX)) return fail('That save’s standings are out of range.');
        rep[k] = p.rep[k];
      }
    }

    const runs = [];
    if (p.runs !== undefined) {
      if (!Array.isArray(p.runs)) return fail('That save’s records are damaged.');
      if (p.runs.length > MAX_RUNS) return fail('That save holds more records than the game keeps.');
      for (const r of p.runs) {
        const c = cleanRun(r, schema, t);
        if (!c) return fail('That save’s records are damaged.');
        runs.push(c);
      }
    }
    const progress = { done, rep, runs };
    if (p.prologue !== undefined) progress.prologue = p.prologue;
    return { ok: true, progress };
  }

  const api = { APP, V, MAX_BYTES, MAX_RUNS, REP_MIN, REP_MAX, exportSave, parseSave };
  root.K9Save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
