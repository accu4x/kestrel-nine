---
title: Engagement, modules, ship classes and runs
status: design draft (not canon); decisions in OPEN-ITEMS items 31–37
updated: 2026-10-01 (lore interview round 5; patrons, hulls, relays)
---

# Engagement, modules, ship classes and runs

Design notes for the next pillar after the v1 arcade. Like `lore/MISSIONS.md`, this file may name
the underlying problems; **in-game text never does.** Nothing here is canon until Dan promotes it
(`lore/CANON.md`). Module names in §3 are working names; each patron faction's in-fiction names are in §9, for Dan's review.

Decided by Dan on 2026-09-30:

- Combat is a new job type, **Engagement**, built first (item 31).
- **Ship modules** are the build-crafting pieces, and they apply to **every** job type (item 32).
- **Ship classes** with strengths and weaknesses (item 33).
- A **roguelite run** mode: modules are bought during a run and reset after it; ship classes
  unlock over time (item 34).

Dan's reference points: Balatro, Summoners War, Infinity Kingdom and Path of Exile, which are
light on story and endlessly replayable. No pay-to-win and no loot boxes.

## 1. What must not change

- **Deterministic first.** Every number comes from the engine. No dice in combat: the enemy's
  moves are shown before you commit.
- **NAV-7 alone stays honest and beatable.** Its Engagement procedure is a real one-pass greedy
  rule. It is never nerfed with noise; instances are tuned instead.
- **Statute 4.1.** In centaur mode NAV-7 polishes and advises and never originates a plan. No
  module may change that.
- **Disable, never destroy** (`lore/WORLD.md` tone). Salem's Armada is the one faction that
  shoots to kill; the pilot still only disables and escapes.
- **Fair comparison.** NAV-7, polish and the charted best always play under the same modules as
  the pilot.
- **No problem names** in job titles, module names, NAV-7 lines or tooltips.

## 2. Engagement (job type 5)

`[built 2026-10-01 as phase A. The build departs from this section in five places, each listed
with its reason in OPEN-ITEMS item 31: the score, the firing order, the special subsystems,
NAV-7's view of the grapple, and the numbers.]`

### Fiction

A hostile ship intercepts you. Your drive needs a few rounds to spool. Survive until you can
jump, take as little hull damage as you can, and leave its sensors dark so it cannot follow.

### Rules

- **Rounds.** The fight lasts R rounds. You jump at the end of round R.
- **The enemy** is a vector wireframe with 4–6 **subsystems**: weapon mounts, a sensor array,
  engines. Each has a **disable threshold** (integer points). Damage past the threshold is
  wasted: the subsystem goes dark and nothing is destroyed.
- **Shown intent.** Every weapon mount has a fixed firing schedule, visible from the start: the
  rounds it fires, its damage, and the **arc** it hits (fore, port, starboard or aft). A mount
  that goes dark before its round cancels that shot.
- **Engines.** Disabling the enemy engines shortens the fight by one round (you jump a round
  early).
- **Sensors.** If the sensor array is still up when you jump, you are **tracked**, which costs a
  fixed penalty.
- **Your ship.** A reactor gives P power each round. Each of your weapons has a power cost and a
  damage value. Each shield arc costs 1 power and blocks up to S damage in that arc that round.
- **A plan** assigns every weapon each round, to a subsystem or to hold, plus the shield arcs to
  power. The whole plan is committed before the fight runs, like a Haul route.
- **Score** (lower is better, `dir: 'min'`): hull damage taken, plus the tracked penalty.
  Unspent power breaks ties.

### Who you fight (Dan, 2026-10-01: a wide cast)

Each faction is a **doctrine**: a generator profile plus at most one special subsystem. Every
special rule depends only on which enemy subsystems are still active, so it stays inside the
DP's state and costs no extra solver work.

| Faction | Doctrine | Special subsystem |
|---|---|---|
| **Galactic Inquisition** (Vey's cutters) | Moderate guns, a hard-to-crack sensor array. They disable and seize. | **Grapple:** if it is still active at the end of the fight, you are **seized**, which costs a heavy penalty, like being tracked but worse. |
| **Salem's Armada** | Many mounts, high damage, low thresholds: glass cannons. The one faction that shoots to kill; you still only disable and escape. | None. The danger is volume. |
| **Mining Guild security** | Few guns, heavy plating (high thresholds), strong engines. Only met on Guild claims. | None. Fights run one round longer. |
| **Black Market enforcers** | Balanced. They come to collect. | **Drain:** while it is active, your reactor gives 1 less power each round. |

*Parked:* an Armada "foresight" mount that fires at your least-shielded arc would suit the
rumor of precognitive scouts. It is deterministic, but it breaks the shortcut that lets the DP
skip enumerating shields (×16 per round), so it waits until the solver has headroom.

### Underneath (design note)

A multi-round weapon-target assignment with a per-round power budget. Assignment with thresholds
and a budget is a relative of Survey's knapsack flavour, and the rounds add scheduling. What makes
it interesting is splitting damage across rounds to finish a subsystem, choosing whether to spend
power on engines (a shorter fight) or on guns (fewer shots), and whether the sensor penalty is
worth chasing.

### Engine interface

Same shape as the other four types in `engine.js`: `generate`, `empty`, `complete`, `evaluate`,
`machine`, `polish`, `suggest`, `exact`, `charted`, `format`, `describe`.

- **`machine` (NAV-7 alone): greedy by threat removed per unit of power, round by round.**
  Each round it fires at the subsystem whose disabling cancels the most upcoming damage per power
  spent, then puts leftover power into the arc with the most incoming damage. It has no lookahead:
  it never starts a subsystem it cannot finish this round, ignores the engine shortcut, and values
  the sensors only in the last round. That makes it decent and beatable.
- **`polish`**: local search over single changes (one weapon's target in one round, or one arc
  on or off), re-simulating after each change and keeping any improvement.
- **`suggest`** (advisory): the best single change, worded as "Advisory: move the forward
  battery to the port mount in round 2 (−4 hull)."
- **`exact` (charted best)**: dynamic programming over (round, remaining threshold of every
  subsystem), taking the best plan into each state. Shields do not need enumerating: once the
  weapon assignment for a round is fixed, powering the arcs with the most blockable incoming
  damage first is optimal, because every arc costs the same 1 power. So the per-round choices are
  only the weapon assignments. Worst cases, before pruning unreachable states: M has
  5⁵ states × 6³ assignments × 4 rounds ≈ 2.7 million steps, and L has
  5⁶ × 7³ × 5 ≈ 27 million. Both should run in about a second in the browser. If L proves too
  slow, it falls back to beam search labelled "best known", like Haul above 15 stops (tech debt
  item 14).

### Sizes (starting point; tune with `engine.test.cjs`)

| Size | Rounds | Subsystems | Your weapons | Reactor |
|---|---|---|---|---|
| S | 3 | 4 | 2 | 4 |
| M | 4 | 5 | 3 | 5 |
| L | 5 | 6 | 3 | 5 |

**Tuning target:** NAV-7 alone should match the charted best in roughly 30–50% of M instances.
That is Survey's figure after item 10, and it keeps "machine alone" and "pilot plus machine"
honestly different.

### Presentation

The vector look already fits: your ship at left, the enemy wireframe at right, and the arcs drawn
as four quadrant strokes. Shown shots are dashed lines with the round number. A subsystem going
dark dims its strokes. The plan editor is a small grid, rounds by weapons, plus arc toggles. The
fight replays deterministically at the debrief, three times: NAV-7's plan, yours, and the
together run.

## 3. Modules

### Principles

1. **Modules change the rules, not just the numbers** (BACKLOG, *World*). "+10% yield" is out.
   "Overlapping coverage now pays" is in.
2. **Every module declares a solver cost**, and we prefer the cheap kinds:
   - **A: instance transform.** It edits the generated map before anyone plays (a cheaper rig,
     a weaker bubble). Every solver works unchanged. Free.
   - **B1: scoring change on an exhaustive type.** It only changes `evaluate`, and the type's
     `exact` enumerates every candidate (Survey, Treaty), so the charted best stays exact for
     free. NAV-7 and polish call `evaluate` too. Cheap.
   - **B2: scoring change that needs solver work.** Held-Karp, branch and bound, or the
     Engagement DP need a change. Each one is a real task with its own test.
   - **C: centaur module.** It changes the partnership (advisories, polish depth), not the
     puzzle. The charted best is untouched.
3. **One of each module.** No stacking duplicates.
4. **Records key on seed plus loadout.** The Centaur Index compares like with like. The daily
   seed and the arcade keep a fixed loadout (none, or the day's announced one) so everyone plays
   the same puzzle.
5. **Legality (Dan, 2026-10-01).** Ordinary modules are Consortium-certified and sold at the Ring
   Market. **Engine mods** (the C modules) make an engine less "glass", so they are illegal under
   the Accord: only the Black Market Purveyors sell them, at a standing cost.

*Phase B note:* Second Opinion raises the advisory cap to four. `save.js` checks
`advisoriesUsed` in 0–3, so its schema changes with that module.

### Starter set (13)

| Module (placeholder name) | Job | Rule | Kind | Solver note |
|---|---|---|---|---|
| **Slipstream Coil** | Haul | The single longest leg of your route costs nothing. | B2 | `evaluate` = total − max leg. Held-Karp gains a "free leg used" bit (states ×2). Changes the shape: one huge jump becomes attractive. |
| **Ghost Hull** | Haul | Sensor bubbles cost ×1.5 instead of ×2.4. | A | Edit `hazard.mult` in the instance. |
| **Open Charter** | Haul | No need to return home. | B2 | Path instead of tour. Held-Karp drops the closing leg; nearest-first unchanged. |
| **Overlap Refinery** | Survey | A deposit reached by two rigs yields 150% instead of 100%. | B1 | Only `evaluate` changes; greedy-by-marginal-yield and exhaustive still apply. |
| **Light Rigs** | Survey | Every rig costs 1 credit less (minimum 1). | A | Edit rig costs. |
| **Wide-band Emitter** | Blockade | Jammers at hubs (4+ lanes) cost 1 less. | A | Edit node weights. |
| **Leak Tolerance** | Blockade | You may leave one lane open. | B2 | Partial cover. Branch and bound needs a "one uncovered edge" allowance and a revised bound. |
| **Silver Tongue** | Treaty | Your single heaviest unmet demand counts as met. | B1 | `evaluate` change only; exact is exhaustive. |
| **Capacitor Bank** | Engagement | Unspent power carries to the next round (up to 2). | B2 | DP state gains the carry (×3). |
| **Arc Discharge** | Engagement | Damage past a threshold spills to one adjacent subsystem. | B2 | Simulation change; the DP is unchanged in shape. |
| **Hardened Aft** | Engagement | The aft shield arc blocks double. | A | Edit shield values. |
| **Second Opinion** | All | +1 advisory (four in total). | C | Records must log it: the Centaur Index splits by advisory count. |
| **Deep Polish** | All | Polish uses a wider neighbourhood (Haul 3-opt; others pair moves). | C | New polish variants; NAV-7 alone never gets them. |

Synergies should come out of the rules rather than be written in: Slipstream plus Open Charter
(one long one-way run), Overlap Refinery plus Light Rigs (many cheap overlapping rigs), Capacitor
Bank plus Arc Discharge (save up, then one big overflowing volley).

**Build tension:** C modules make the partnership stronger; A and B modules make the ship
stronger. Choosing between upgrading the pilot's side and the engine's side is where the Centaur
thesis lives inside the build.

## 4. Hull classes: one mind, one body

Dan, 2026-10-01: your mind is downloaded into a ship and can inhabit **one hull at a time**. A
mind cannot clone itself (canon, `lore/FACTIONS.md`). The *Second Wind* is your first body, a
Courier hull. Each season you transfer into the hull class you choose. This replaces "refits of
the *Second Wind*" from earlier the same day (OPEN-ITEMS item 37).

**Classes change the loadout and the season economy; modules change the puzzle.** That split
keeps solver work inside the module list. Each patron faction has its own name for every class
(§9); the mechanics are the same.

| Class | Slots | Reactor | Hull | Range | Class rule | Weakness |
|---|---|---|---|---|---|---|
| **Courier** (the *Second Wind*) | 3 | 4 | 10 | Long | Haul jobs pay +25% | Few slots, weak in a fight |
| **Hauler** | 5 | 3 | 16 | Short | Survey (and later Trade) pay +25% | Slow: each jump costs double fuel |
| **Escort** | 3 | 6 | 12 | Short | Engagement pays +25% | Little room for utility modules |
| **Relay Tender** | 4 | 4 | 8 | Medium | Blockade pays +25%; one Blockade module is free | Fragile |
| **Envoy** | 4 | 3 | 8 | Medium | Treaty pays +25%; a fourth advisory in treaties | Nearly unarmed |
| **Salvor** | 4 | 3 | 14 | Medium | After an Engagement, may take one module from the disabled ship | Pays no bonus on any job |

- **Envoy (Dan, 2026-10-01):** its fourth advisory is an engine mod, which §3 makes illegal, so its
  charter papers carry a **diplomatic exemption**, legal in treaties only. Tollgate's notaries
  bend the Accord.
- **Salvor:** its hulls come out of Nyx Verge's freighter graveyard.

Unlocks are **sideways, not upward**: new hull classes and a wider module pool, never permanent
stat boosts. A new player and a veteran on the same seed, patron and class face the same puzzle.

## 5. Runs: a contract season

Dan, 2026-10-01: a run is **a contract season**. You start each season with a clean hold: the
season's modules are sold off to settle up, and what you keep is your history (unlocked hull
classes).

### Patron and hull

At the start of a season you choose a **patron faction** and a **hull class**. You are Augmented
either way, working inside the patron's ranks.

| Patron | Naming style | Signature (approved 2026-10-01) |
|---|---|---|
| **Academia** | Mythic | *Archive access:* you see the charted-best score (never the plan) before you fly. |
| **Salem's Armada** | Spacer slang | *Plunder:* each enemy weapon mount you disable in an Engagement pays credits. |
| **Miners' Union** | Work-crew talk | *Solidarity:* Survey jobs get +1 rig budget. |
| **Consortium** | Financial instruments | *Credit line:* Ring Market prices 20% lower; Black Market buys cost double standing. |

Every patron sells **the same 13 module mechanics** under its own names (Dan, 2026-10-01), plus
its one signature. `[clarified 2026-10-01: of the 13, the 11 certified mechanics take patron
names (§9); the two engine mods are Lantern contraband with one shared name each, Second Lantern
and Cracked Glass, and get no patron variants]` The patron also sets the shop's look and the season's story beats. The
campaign is untouched: it stays Laplace and Winter. The Outer Relay Commune is NPC-only and runs
the relays.

### The season map

- **The map.** A seeded sector map of 12–15 nodes in 5 columns, with branching paths. The season
  code (for example `RUN-7F3A`) fixes the map, every shop's stock, the finale and the hidden
  contact (below), so a season is shareable and there can be a daily season.
- **Nodes.** Job (the type is shown), Ring Market (certified modules), Black Market (Lantern
  contraband and other illicit goods, at a standing cost), dock (repair hull), **relay** (your
  backup is refreshed here), and later event nodes that plug into the dialog trees (item 28).
- **Credits** come from jobs, scaled by the result's percentage of the charted best (`pctOf`),
  so solving well pays.
- **Flying a job in a season.** Each job is flown once. Before it, the pilot chooses **Linked**
  (centaur, pay ×1) or **Unlinked** (solo, pay ×1.5). NAV-7's own run is always shown at the
  debrief. Whether to trust the machine becomes an economic choice every job.

### Losing a hull

- Engagement damage carries across the season. **At zero hull the hull is lost** (the Armada
  destroys; the Inquisition seizes). Your mind is not: the inert backup at **your last relay**
  wakes in a fresh hull of the same class.
- You keep what you had at that relay and lose everything gained since: credits, modules and
  map progress after it.
- **A restore has a cost** (Dan, 2026-09-28: backups restore "with a cost"): a credit fee. If you can't pay it,
  the season ends.
- The player's own weapons still only disable. Losing a hull is something done *to* you.

### The hidden Lantern contact

Dan, 2026-10-01: the Lantern runs covert agents inside every faction. Each season hides **one
Lantern contact** for the player to find or ignore. It should be "subtle so it's a slight
challenge a player can find".

- **Where:** the season seed places the contact inside one ordinary node (a job, a market or a
  dock). Nothing on the map marks it.
- **The clue is a captain-word.** One ordinary word, drawn by seed from a fixed list, appears
  twice in the season's text: once in an earlier node's text (a briefing line, a dock notice)
  and once at the contact node. Nothing highlights it.
- **Making contact:** at the contact node, one of the fixed dialog options uses the word. Choosing
  it makes contact. Players never type anything (item 26): it is always a choice among options.
- **Ignoring it costs nothing.** No prompt, no penalty, no nag. Most players will never know it
  was there.
- **Reward:** one Lantern job (a variant with an extra constraint, such as "leave no trace"), the
  contraband at a fair price, and a ledger flag (`lantern_contact`) that dialog trees can read.
- **The twist is not decided.** Dan: it "could add a twist later in the scenario". The ledger
  flag is the hook; what the twist is stays Dan's call.

### Finale and length

- **The finale** is an L-size Engagement. **The season seed picks the faction** (Dan,
  2026-10-01) from the four doctrines in §2, so variety stays deterministic. Black Market
  enforcers are weighted up when your Purveyor standing is low. Later the finale can also be a
  Purge decoy node (BACKLOG).
- **Length:** 8–10 jobs, about 30–45 minutes.

## 6. Build phases (for the Claude Code handover)

| Phase | Scope | Done when |
|---|---|---|
| **0** | The prologue (OPEN-ITEMS item 35): Laplace's scene out of Mission 1 into a first-launch `PROLOGUE` with the fly-or-not choice. `[amended 2026-10-01: one choice, "(Take the helm.)", which always opens Mission 1; item 35]` | First launch plays it once; both choices route correctly `[amended 2026-10-01: the one choice and Skip both open Mission 1]`; challenge links bypass it; existing saves with Mission 1 done never see it forced; save tests pass. |
| **A** | Engagement as job type 5: engine, the four doctrines, arcade (S/M/L), daily seed, debrief replay, result card, challenge codes (`ENGA-M-xxxx`). | `engine.test.cjs` covers Engagement for every doctrine; NAV-7 optimal rate is inside target; leak test clean; both editions and the site edition rebuilt. |
| **B** | Modules and license classes in the engine: loadout-aware `generate` and `evaluate`, the A/B1/C modules first, then the B2 modules one at a time. Records key on seed plus loadout. | Every module has a test proving the charted best is still exact (or labelled "best known") and that NAV-7 is still beatable. |
| **C** | Contract seasons: patron and hull choice, sector map, shops, relays and restores, the hidden Lantern contact, Linked/Unlinked choice, seeded finale, class unlocks, daily season. | A seeded season replays identically; save export and import (item 27) cover season state. |

The Purge decoy mission, Trade and deeper Diplomacy stay in BACKLOG.

## 7. Lore interview, round 5 (2026-10-01)

Dan's answers, recorded as design decisions (OPEN-ITEMS item 36). They become canon only when Dan
approves the names in §9 and the lore files are edited (`lore/CANON.md`).

| Question | Dan's answer |
|---|---|
| Where does Laplace's scene go? | A first-launch prologue whose "Fly it or don't" is a real choice (item 35). `[amended 2026-10-01: Dan, "make the reply only be 1 choice"; it ends with "(Take the helm.)" and always opens Mission 1]` |
| Whom do you fight? | A wide cast: Inquisition, Armada, Mining Guild security, Black Market enforcers (§2). |
| Which faction is the finale? | Set by the season seed (§5). |
| What are modules in-fiction? | Certified by default; engine mods are illegal and only the Purveyors sell them (§3). |
| How do classes fit the *Second Wind*? | License-class refits of the one ship. `[superseded same day: you transfer into hulls, one at a time, below]` |
| Where does the Salvage refit come from? | The Nyx Verge freighter graveyard (§4). |
| What is a run? | A contract season (§5). |
| What are the player's factions? | Four patrons, chosen each season: Academia, Salem's Armada, the Miners' Union, the Consortium, each with its own naming style. The Lantern are covert agents inside all of them; the Outer Relay Commune is NPC-only (§5). |
| How different are the patrons? | The same 13 mechanics plus one signature each (§5). |
| How do backups work? | One mind runs at a time; an inert backup at the last relay wakes if the hull is lost. Canon amended in `lore/FACTIONS.md` (§5). |
| What is a class? | A hull your mind transfers into, one at a time; the *Second Wind* is the first (§4). |
| A hidden Lantern contact? | Yes: subtle, findable, ignorable, with a possible twist later (§5). |
| Who writes the names? | Claude drafts, Dan reviews (§9). |

## 8. Open risks

- **Scope.** Three phases is a lot of hobby time. Phase A stands alone and is worth shipping even
  if B and C never happen.
- **Solver drift.** B2 modules are where bugs hide (a charted best that is not really best).
  Each one needs its own exactness test.
- **Records sprawl.** Seed × loadout multiplies record keys. The Records screen needs a "no
  modules" view that stays the headline number.
- **Mobile.** Engagement's plan grid adds more small UI (item 13).

## 9. Names (approved by Dan, 2026-10-01)

*Approved 2026-10-01: the four sets, the Lantern contraband and the hull names below. They enter
`content.js` with phase B, and the lore files at the same time. Flavour lines for the certified
names are still to write.*

Dan, 2026-10-01: names should be "more sci-fi flavored and less functional flavored", and each
patron gets one naming style. The Consortium's style is financial instruments ("that is
perfect"). Glass & light moves to the Lantern's contraband. No problem names, no real people.
Myth names must not reuse place names already in canon (Orpheus Reach, the Persephone Belt, the
Vesta Cluster, the Aurelian Ring). Working names from §3 are in the first column.

### Certified modules, by patron

| Mechanic (working name) | Academia (mythic) | Armada (spacer slang) | Miners' Union (work-crew) | Consortium (financial) |
|---|---|---|---|---|
| Longest leg free (Slipstream Coil) | Zephyr Coil | Long Leap | Long Drift | Bridge Loan |
| Bubbles cost less (Ghost Hull) | Hades Cowl | Ghostskin | Dust Skirt | Customs Hedge |
| No return trip (Open Charter) | Icarus Charter | No-Return Ticket | Last Shift | Non-Recourse Note |
| Overlap pays (Overlap Refinery) | Gemini Bore | Double-Dip Drill | Double Stope | Compound Yield |
| Cheaper rigs (Light Rigs) | Ceres Rigs | Lifted Rigs | Jackleg Rigs | Volume Rebate |
| Cheaper hub jammers (Wide-band Emitter) | Echo Choir | Crossroads Howler | Crosscut Charge | Hub Arbitrage |
| One lane left open as bait (Leak Tolerance) | Siren Lane | Open Door | Canary Lane | Loss Leader |
| One promise forgiven (Silver Tongue) | Peitho Seal | Sweet Talk | Grace Shift | Grace Period |
| Power carries over (Capacitor Bank) | Prometheus Cell | Banked Fire | Powder Store | Rollover Credit |
| Overflow spills (Arc Discharge) | Typhon Arc | Chain Lightning | Chain Blast | Contagion Clause |
| Double aft shield (Hardened Aft) | Aegis Aft | Tailguard | Tailings Plate | Exit Insurance |

Consortium alternates, if any land better: Long Call, Tariff Waiver, Forward Contract, Double
Dividend, Bulk Discount, Spread Play, Short Position, Default Clause, Escrow Cell, Cascade
Liability, Indemnity Plate.

### Lantern contraband (the same in every season)

| Mechanic | Name | Flavour line |
|---|---|---|
| A fourth advisory (Second Opinion) | **Second Lantern** | One more light on the console, from an engine that should not have one. |
| Deeper polish (Deep Polish) | **Cracked Glass** | Engines must be glass. This one has a flaw you can see through. |

### Hulls, by patron

| Class | Academia | Armada | Miners' Union | Consortium |
|---|---|---|---|---|
| Courier | Mercury | Runner | Skip | Bearer |
| Hauler | Atlas | Mule | Ore Car | Future |
| Escort | Athena | Hound | Shotfirer | Guarantor |
| Relay Tender | Hecate | Static-Jack | Brattice | Clearinghouse |
| Envoy | Iris | Silk | Shop Steward | Underwriter |
| Salvor | Charon | Crow | Mucker | Receiver |

Notes for review:

- **Brattice** is a mine wall that redirects airflow, which is what a jammer does.
- **Receiver** is receivership: it takes the assets of ships that failed.
- **Hecate** is the goddess of crossroads, for the hub jammer.
- **Canary Lane** and **Loss Leader** both mean bait.
- Flavour lines for the 44 certified names come after the names settle.
