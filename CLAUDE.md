# Kestrel Nine

A retro vector space game of minds and machines, grown from the GalaxAI spec. **A hobby**
(started 2026-09-28): fun first, no monetization driver, delivered as a **Claude artifact**.
Its purpose is to argue the **Centaur thesis** through play: a person working with a machine
beats either one alone on hard problems.

## Read first, in this order

1. `../AGENTS.md`: workspace rules, hard constraints, Slate design system. It is the system of
   record above this file.
2. This file.
3. `lore/WORLD.md`, then the rest of `lore/`: canon.
4. `OPEN-ITEMS.md`: decisions so far, dated, and open questions.
5. `BACKLOG.md`: what comes after the small arcade.

## Private design context

Private design context lives outside this repo, in `../private/kestrel-nine.md`. Read it if it is
present. Never copy it, or any paraphrase of it, into this repo: not into code, content, lore,
docs, commit messages or PRs. If a public draft seems to need it, ask Dan instead.

## The rules that matter most

- **Ask, then plan, then build.** Ask Dan whatever is ambiguous, show him the plan, and wait for
  his OK before writing code or files.
- **No complexity-theory names in the game.** P vs NP is the purpose behind the design, not a
  theme. In-game text never says "NP", "traveling salesman", "vertex cover" and so on. Design
  notes (`lore/MISSIONS.md`, this folder's docs) may.
- **Deterministic first.** The engine computes every number: generators, NAV-7's procedures,
  polish, advisories, the charted best. No model runs during play and no player text goes to a
  model: every line of dialog ships as static content (OPEN-ITEMS items 26 and 28). Claude drafts
  dialog trees before release; Dan reviews them like canon.
- **NAV-7 alone must stay beatable and honest.** Its procedures are real one-pass heuristics.
  Never nerf them with random noise to flatter the player. Tune instances instead
  (`artifact/test/engine.test.cjs` prints how often the heuristic is optimal).
- **Canon is curated.** Players write rumors; Dan promotes canon. Procedure: `lore/CANON.md`.
- **Git:** a Cowork session never runs git (`../AGENTS.md`). Repo work belongs to Claude Code.
  This is a **public** repo: run `leak.test.cjs` before every push.

## Layout

| Path | What |
|---|---|
| `lore/` | Canon: world, factions, characters, places, missions, the canon process. |
| `artifact/src/engine.js` | Puzzles and solvers. Runs in the browser and in Node. |
| `artifact/src/content.js` | Campaign, dialog, NAV-7 lines. Must agree with `lore/`. |
| `artifact/src/render.js` | Vector stroke font, wireframe primitives, WebGL CRT pass. |
| `artifact/src/game.js` | Screens, input, records, Rumor Net. |
| `artifact/src/style.css`, `template.html` | Console styling (Slate tokens) and page shell. |
| `artifact/src/save.js` | Save-file export and strict import (site edition, item 27). |
| `artifact/src/sw.js`, `site-headers.txt` | Service worker and `_headers` (CSP) for the site edition. |
| `artifact/build.mjs` | Inlines everything into `artifact/dist/kestrel-nine.html`; `--site` writes the installable app to `artifact/dist/site/`. |
| `artifact/icons.mjs` | App icons, vector-drawn, encoded with `node:zlib` only. |
| `wrangler.jsonc` | Assets-only Worker on the route `play.latentmirror.com/kestrel-nine*`. |
| `artifact/test/engine.test.cjs` | Solver checks and heuristic-gap stats. |
| `artifact/test/save.test.cjs` | Save files round-trip; every validation rule rejects a bad file. |
| `artifact/test/smoke_site.py` | Headless check of `dist/site/` under its real CSP, including the offline start (Python Playwright). |
| `artifact/test/leak.test.cjs` | Private-phrase and secret scan of every publishable file (`--dir` for a build, plus problem names). |

## Build and test

```
node artifact/test/engine.test.cjs     # every solver valid; prints NAV-7 vs charted-best gaps
node artifact/test/leak.test.cjs       # before every push; fails closed (OPEN-ITEMS item 30)
node artifact/build.mjs                # home edition: artifact/dist/kestrel-nine.html
node artifact/build.mjs --public       # public edition: artifact/dist/kestrel-nine-public.html
node artifact/test/save.test.cjs       # save-file rules
node artifact/build.mjs --site         # site edition: artifact/dist/site/kestrel-nine/ + _headers
node artifact/test/leak.test.cjs --dir artifact/dist/site
python artifact/test/smoke_site.py     # headless: CSP, a mission to the debrief, saves, offline start
npx wrangler deploy                    # site edition to play.latentmirror.com/kestrel-nine/
```

The site edition is the public edition plus `window.K9_SITE`: separate `app.js` and `app.css` (its
CSP allows no inline script or style), a manifest, icons, a service worker, save export and import
on the Records screen, challenge links (`?c=HAUL-M-7F3A`) and an install button. Its result cards
point at the play URL; the claude.ai editions keep theirs.

Publish each file to its own artifact URL (see `OPEN-ITEMS.md`). The home edition declares `db`
and `user` (keep the canon write rule); the public edition declares no capabilities, and must
never declare `db` or `mcp`, which would stop it being shared by link. Neither edition declares
`sample` (item 26). Both builds share
every source file; `window.K9_PUBLIC` switches off the Rumor Net and shared Records.

Latent Mirror shows the game as an artifact page with a link out to the public edition (no
iframe). Screenshots for it go in `docs/showcase/`, captured in demo state.

## The artifact's database

| Collection | Written by | Contents |
|---|---|---|
| `runs` | the page | One document per pilot per map (`<seedKey>~<uid>`), best result kept. Feeds the Records and the Centaur Index. |
| `rumors` | the page | Ship's Logs filed after a job. Untrusted player text. |
| `canon` | Dan and Claude only (`admin` rule) | The Chronicle. Mirrors `lore/WORLD.md` plus promoted rumors. Fields: `order`, `cycle` (null for the deep past), `era` (for example "NC 1990–2190"; deep past only), `title`, `body`, `source`. |

The store holds at most 5,000 documents. A canon review is the natural time to prune old rumors.
