# Backlog

Ideas and the long-game direction. Decisions live in `OPEN-ITEMS.md`.

## Next pillars (from Dan's brief, 2026-09-28)

- **Market (trade runs).** Buy and sell across ports with a limited hold and fuel. Underneath:
  prize-collecting routing plus knapsack. Needs a light economy model: prices that drift by
  port and by what players sold yesterday.
- **Combat, deeper.** The spec's bridge combat: range bands, shield arcs, a threat clock,
  disable-not-destroy. Blockade is the first step. A turn-based engagement could sit on top of
  scheduling or resource-allocation problems.
  - **A Purge engagement, so "resist the Purge" holds.** `[added 2026-09-28]` The public
    description says pilots "resist the Purge", but today the game only evacuates ahead of it
    (mission 6). Dan: "maybe we can come up with a combat scenario and keep resist" (OPEN-ITEMS
    item 20). Resisting here should mean holding it off, not destroying it: disable, decoy,
    shield, escape (`lore/WORLD.md` tone). It must not settle what the Purge is (`lore/CANON.md`),
    and the in-game text must not name the underlying problem. Its nearest-first sweep (mission 6)
    is an existing hook: a machine the pilot can out-think by going wide.
- **Diplomacy, deeper.** Multi-round treaties where delegates react to your earlier terms;
  reputation from the campaign changes the weights.
- **Relay frequencies.** Assign channels so neighbouring relays never clash (graph coloring).
  A natural Augmented secrecy job.

## Self-hosted PWA and open data `[added 2026-09-28; decisions in OPEN-ITEMS items 25–28]`

- ~~**Artifact-to-PWA tool (open source).**~~ `[dropped 2026-09-28, OPEN-ITEMS item 29]` Once Kestrel Nine's site edition works, pull out the
  generic parts: a scan for which Claude features an artifact uses; a `window.claude` shim with
  switchable backends; the PWA shell (manifest, icons, service worker) with assets split out for
  a strict CSP; discovery metadata (schema.org `SoftwareApplication`, an `apps.json` feed, a
  Mastodon announcement); and guardrail checks (no secrets, a private-phrase denylist, a
  license). Look at Artiport (github.com/ric-growthclan/artiport) first; contributing to it may
  beat starting from scratch.
- **Global data (phase 2: opt-in, anonymous).** Uploads are IDs and numbers only: choice records
  (`tree`, `node`, `choice`) checked against the shipped trees; centaur numbers (seed, solo,
  together, charted best); a random install ID and the game version. No names, accounts or text.
  - **Verified scores.** A run is submitted as seed + plan; the Worker replays it with the engine
    and computes the score itself, so a made-up score fails.
  - **Rank without names.** Each player sees only their own percentile per map.
  - **Showing it back.** In-game aggregates (for example "41% of pilots chose…"), centaur stats
    per map, and a private dashboard for canon reviews. Choice aggregates also feed the next
    round of dialog trees (item 28, "play reports").
  - Needs rate limits, a retention rule and a plain-language data notice.

## World

- A persistent galaxy map that grows as canon is promoted: new stations, new routes.
- Faction reputation that matters: prices, who will talk to you, which jobs are offered.
- Ship upgrades that change the rules, not just the numbers (a second advisory, a wider polish).
- Ledger unlocks: titles, achievements and easter-egg missions driven by the choice ledger
  (OPEN-ITEMS item 28).
- A second campaign after the Lantern opens.

## The Centaur thesis, as data

- Show the Centaur Index per job type and over time.
- Record how pilots used the engine (advisories, polishes, starting from solo or fresh) and
  show which habits produce the best centaur results.
- A "machine only with polish" baseline, so the Records separate the value of the pilot's shape
  from the value of the engine's polish.

## Craft

- Sound: a short synth motif per faction.
- Accessibility: a high-contrast mode without the CRT pass; keyboard selection of map nodes.
- Performance: skip the bloom pass on low-power devices.
