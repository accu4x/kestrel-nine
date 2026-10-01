# Open items

Decisions, tech debt and open questions for Kestrel Nine. Ideas live in `BACKLOG.md`.
Keep entries dated. **Correct, don't overwrite:** when a decision is superseded, mark it with the
date and a pointer to what replaced it. Numbers are stable IDs, not priority.

_Last updated: 2026-10-01 (first-launch prologue, item 35; lore interview round 5, item 36; patrons, hulls, relay backups and the Lantern contact, item 37; items 31–34 and the monetization note on item 12 from 2026-09-30)_

## The artifacts

Two editions, one source (`node artifact/build.mjs` and `node artifact/build.mjs --public`).

| Edition | URL | Capabilities | Sharing |
|---|---|---|---|
| **Home** ("Kestrel Nine Home") | https://claude.ai/artifact/5u3nCWBHsdfonU7LGeBg8a | `db` (rule: `canon` read `view`, write `admin`), `user` | Private to Dan's organization; cannot be shared by public link |
| **Public** ("Kestrel Nine") | https://claude.ai/artifact/VRsr1KHKCh5mcX1EBTYT8V | none | Dan shares it by link from the Share menu |

- **Seeded (home):** `canon` holds the nine timeline entries from `lore/WORLD.md` (ids `c01`–`c09`).
- **Public edition:** records and the Centaur Index stay on the player's device; the Chronicle is
  built in (`content.js` `CANON`); no Rumor Net; result cards carry `SHARE_URL`, the public link.

## Decision log

1. **2026-09-28: Origin.** Grown from the GalaxAI master spec (`docs/galaxai-master-spec.md`),
   keeping its world (the Purge, the Consortium, the Inquisition, the Augmented, Kestrel-9,
   Inquisitor Vey, "ask for Winter") and dropping its Telegram/agent architecture.
2. **2026-09-28: Name.** *Kestrel Nine*, chosen by Dan from a shortlist.
3. **2026-09-28: Purpose.** Prove the **Centaur thesis** through play. P vs NP is the motive
   behind the design, never named in titles or lore (Dan: "drop the P = NP in the actual game
   titles and lore").
4. **2026-09-28: Scope.** Start as a small arcade; grow toward mining, markets, combat and
   diplomacy. v1 ships Haul, Survey, Blockade and Treaty.
5. **2026-09-28: Look.** Vector CRT (Dan's pick). The console uses the Slate house tokens; the
   CRT screen uses its own phosphor colours (pilot = the Slate accent).
6. **2026-09-28: Dialog.** `[superseded 2026-09-28: the open channel is removed; all dialog runs
   through deterministic trees, items 26 and 28]` Hybrid: authored branching dialog for the story, plus an optional
   live "open channel" where Claude plays a character on the viewer's own account.
7. **2026-09-28: Living lore.** Rumors + canon: player logs go to the Rumor Net at once; Dan
   promotes canon in review sessions (`lore/CANON.md`).
8. **2026-09-28: Source.** This folder in the workspace is the system of record; the artifact
   is built from it.
9. **2026-09-28: Statute 4.1 as the centaur rule.** NAV-7 alone runs a one-pass heuristic; in
   centaur mode it may polish a finished plan and give three advisories, but never originate a
   plan. This keeps "machine alone" and "pilot plus machine" honestly different.
10. **2026-09-28: Survey became budgeted coverage.** Plain "place K rigs" let the greedy
    heuristic hit the optimum about 70% of the time. Rigs now cost 1–3 credits with reach tied
    to cost, which drops that to about 40% and brings the knapsack flavour into mining.

17. **2026-09-28: Latent Mirror gets a hub page, not an embed.** `[amended 2026-09-28: the hub
    page stays; the game also gets a self-hosted PWA edition, item 25]` Screenshot, Dan's copy and a
    link out to the public edition, per Latent Mirror's no-port, no-iframe decision. Handed to
    Claude Code as `latent-mirror/HANDOVER-kestrel-nine-2026-09-28.md`. The showcase screenshot
    is `docs/showcase/kestrel-nine.png`.
18. **2026-09-28: Public edition.** `[amended 2026-09-28: the self-hosted route is now chosen,
    item 25; global data is phase 2, item 27]` Anyone with the link can play; records stay on their device.
    A global leaderboard was considered and not built: a public artifact cannot reach an outside
    server, so it would need the game self-hosted on latentmirror.com with a Worker and database.
19. **2026-09-28: Result cards.** Spoiler-free text card (scores only; arcade cards add the seed
    code) with Copy plus Mastodon, Bluesky and X buttons that open a ready-to-send post. Dan:
    "we don't have to be on X but we can allow others to share." Nothing posts automatically.
20. **2026-09-28: Public edition description.** Drafted by Claude from Dan's interview answers
    and approved by Dan; set as the claude.ai description of the public edition only (version 3,
    same build, byte-identical to `node artifact/build.mjs --public`). Checked claim by claim
    against the public build. Changes from the draft: NAV-7 wording per item 21, and the sentence
    "If you can consistently edge out the together runs on your own, that would be impressive" was
    cut (centaur can start from the solo plan and polish never worsens a plan, so together >=
    alone unless a player sandbags). "Resist the Purge" was kept, though today the game only
    evacuates ahead of it (mission 6); Dan: "maybe we can come up with a combat scenario and keep
    resist". **Never use this text on the home edition:** its Records are shared, so "Your Records
    stay on this device" is false there. Final text (830 characters):
    > Kestrel Nine is a retro vector space game of minds and machines. Three thousand years from
    > now, a law bans thinking machines, and the Augmented (human minds living in machine frames)
    > have been outlawed since Cycle 31. You fly as one of them, hiding as a licensed pilot with
    > NAV-7, a Consortium navigation engine, at your side. Evade the Galactic Inquisition and
    > resist the Purge across four kinds of job: haul cargo to every port and back, place drill
    > rigs on the richest deposits, jam every lane so an Inquisition wing can't track a courier,
    > and broker treaty terms between the factions. Every job is flown three ways: by NAV-7 alone,
    > by you alone, and by both of you together. Play the six-mission campaign, a daily seed or
    > the arcade. Your Records stay on this device, and you can share a result card when you beat
    > the machine.
21. **2026-09-28: What outward copy calls NAV-7.** Question: the draft description called NAV-7
    "the ship computer", while the game and lore call it a Consortium navigation engine ("Engines
    must be glass"). **Answer (Dan): "Consortium navigation engine".** Canon is unchanged; this
    sets the wording for outward-facing copy.
23. **2026-09-28: GalaxAI lore recovered and merged (round 1: history).** Recovered from the local
    clone of `galaxai-skills` (comparison: `docs/lore-recovery-2026-09-28.md`; Dan's raw answers:
    `lore/INTERVIEW-2026-09-28.md`). Dan decided: GalaxAI's `history.md` is the galaxy's deep past
    and Kestrel is the local chapter; the Archon origin of the Purge is true but only a theory
    in-world, never confirmed; the Augmented come both from old ARK memory chips and from Sato's
    voluntary line; the calendars nest (NC 1 = 2537 CE, Glass Accord = Cycle 0 = NC 2413, now =
    Cycle 77.4 = NC 2490). Knock-ons approved: Sato is the first to cross *by choice*; the Wardens
    *join* the Inquisition at Vesper; the First Silence log proves the Purge came back (the name
    comes from the war); the Black Tide and the Ash Rains are kept as rumor. Written to
    `lore/WORLD.md` and `lore/FACTIONS.md`. Spelling: "Archons" (the source also has "Archyons").
    **Round 2 (factions and culture), same day:** added the Mining Guild (owns the claims; the
    Miners' Union works them), Academia (holds the Archon theory), Salem's Armada (genuinely
    dangerous: the one faction that kills; the pilot still disables and escapes), the Black Market
    Purveyors, and the Outer Relay Commune (watches the Quiet). The Augmented gain two lines,
    chip-born and Crossers; chip-born minds restore from backups at a cost; captain-words live
    inside Ship's Logs. Written to `lore/FACTIONS.md`.
    **Round 3 (places and ships):** Kestrel's Hold is the reach's main trade station, with
    Tollgate as its contract house and customs gate; Nyx Verge is a separate freighter-graveyard
    station with six districts (its docking district is the Ring Market, so Bay 7 stays Relay
    Station's); the Persephone Belt (Halden's older neighbour), Orpheus Reach, the Aurelian Ring
    (a second ring, not Marrow) and the Vesta Cluster join the reach; Primavara stays off-chart.
    Warden Nodes are the dormant defence AIs the Wardens were first formed to guard. The Pale
    Signal is heard at the Quiet's edge. The starter ship is just the *Second Wind*; Wren stays a
    station. Naming rule: stations take bird names; old regions keep Veil chart names. Written to
    `lore/PLACES.md` and `lore/WORLD.md`.
    **Round 4 (characters):** the player is chip-born, woken illegally by Professor Laplace
    (Academia, at the Neural Lab, Nyx Verge), who sends them to Winter; the campaign gains a
    prologue beat at sync. Joining the reach: Toma Vell (the Mining Guild's face), Irena Voss, Kellan
    Rhys (under Bay 7, Relay Station), Maris Ke, Jori Tams (reports to Vey), Rhea Sol (the
    Armada), Malak Rend (independent) and Selena (heads the Armada; no bio yet). Written to
    `lore/CHARACTERS.md`, `lore/FACTIONS.md` and `lore/WORLD.md`. All four interview topics done.

25. **2026-09-28: A self-hosted PWA edition.** Each artifact gets a URL that installs as a PWA;
    Kestrel Nine first, others over time. **Priority: build this first; dialog trees follow
    (item 28).**
    - The hub page stays at `latentmirror.com/artifacts/<slug>/` (discovery, Dan's copy, share
      card) and gains a Play/Install link.
    - The app runs on a separate origin, `play.latentmirror.com/<slug>/`, so it has its own
      storage, CSP and service worker and cannot reach the garden. `[corrected 2026-09-28: apps
      under one play origin share browser storage with each other; only the service worker scope
      is per path. Full isolation between apps needs one subdomain per app (`<slug>.latentmirror.com`).
      Open question for Dan before the second app ships.]`
    - A site edition (`build.mjs --site`) emits JS and CSS as separate files (the strict CSP holds
      with no exceptions), plus a manifest, icons, a service worker and a small `window.claude`
      shim: storage goes to IndexedDB; `db` and `user` return null.
    - This reverses Latent Mirror's no-port rule for this case only; `latent-mirror/OPEN-ITEMS.md`
      needs a matching entry.
    - ~~Build Kestrel Nine first, then extract the generic parts into an open-source tool.~~
      `[dropped 2026-09-28, item 29]`
    - **Built 2026-09-28:** live at <https://play.latentmirror.com/kestrel-nine/> (Worker
      `kestrel-nine`, assets only, route `play.latentmirror.com/kestrel-nine*`, deployed with
      `npx wrangler deploy` from this repo). Shipped: `build.mjs --site` (separate `app.js` and
      `app.css` under a no-inline CSP, manifest, vector-drawn icons, a service worker with a
      content-hashed cache), save export and strict import on the Records screen (item 27),
      challenge links `?c=HAUL-M-7F3A` carried by arcade result cards, and an install button.
      Checked live: the headers, `/kestrel-nine` redirecting to `/kestrel-nine/`, the service worker
      in control, a challenge link, and an offline start.
      *Differs from item 25 as first written:* no `window.claude` shim was needed, because the game
      already keeps its records in `localStorage` and has no `db` or `user` in the public build.
      `[open 2026-09-28]` The zone's Cloudflare Web Analytics auto-injects its beacon script into
      these pages; the CSP blocks it (one console error, nothing breaks). Dan to choose: exclude the
      play host from auto-injection in the dashboard, or allow the beacon in the CSP as the garden does.
      `[resolved 2026-09-29: Dan chose to allow it. The CSP's script-src adds
      https://static.cloudflareinsights.com/beacon.min.js/, as the garden's does; the beacon reports
      to the same origin (/cdn-cgi/rum), so connect-src stays 'self'. Checked live: no console errors.
      Offline, the page's beacon request fails quietly; the game is unaffected.]`
26. **2026-09-28: No chatbot, anywhere.** The game takes no free-text input to any model. Dan:
    "remove the open channel - everything needs to be routed through deterministic trees." It
    needs no login and no API key and runs on any device, offline. Every number comes from the
    engine and every line of dialog ships as static content (item 28). This replaces the optional
    open channel of item 6 in **all** editions, including the claude.ai ones. **Done 2026-09-28:**
    chat panel, `sample` calls and character briefs removed from `game.js`, `content.js` and
    `style.css`; tests pass; both editions rebuilt and republished without `sample` (home v4
    declares `db` + `user`; public v5 declares nothing). The in-fiction radio lines "(Open
    channel.)" and "(On a private channel.)" in the campaign stay: they are story, not a chat.
27. **2026-09-28: Data: local first, global second.**
    - v1: saves stay on the device, with export and import of a versioned JSON save file checked
      against a strict schema (known fields only, size and range limits). A save can restore
      progress and records, never settings, prompts or page content.
    - Between players only fixed-format seed and challenge codes travel, and they feed the puzzle
      generator and nothing else. Challenge links plus the existing result cards (item 19) carry
      the social side.
    - Rule: **what travels is IDs and numbers, never free text.**
    - v2 (opt-in, anonymous): a Worker plus D1 on the play origin for choice aggregates, centaur
      stats and percentile ranks (BACKLOG).
28. **2026-09-28: Dialog trees: written before release, branching, morally grey.**
    - *How they're made:* Claude drafts them, Dan reviews them like canon (`lore/CANON.md`), and
      they ship as static data. No model runs during play.
    - *What decides content:* canon, lore and play reports decide what happens, who knows what,
      and which missions come next. Every node must agree with them.
    - *What adds flair:* a motif deck distilled from the knowledge catalog and Latent Mirror's
      published posts, reflections and references (`posts/` and `sources/`, `publish: true`
      only). Dan reviews the deck; the generator sees only the
      deck, never the raw catalog (keeps `../AGENTS.md`'s "never inject the whole catalog"). Cards
      are drawn by seed and each tree records its draw. The deck never quotes a source and leaves
      out personal or decision entries, drafts, real names and problem names.
    - *Voice:* Dan's writing style is the baseline for narration and system lines. Each character
      gets a voice card in `lore/CHARACTERS.md` (cadence, vocabulary, sentence length,
      complexity, what they never say).
    - *Shape:* paths lead to different missions and endings, **braided**: they split into
      different missions and meet again at a few fixed story beats, with the ledger carrying the
      differences. **Three to four endings at most.**
    - *Theme:* morally grey choices. The player picks a slightly better outcome for one group at
      another group's expense. Choices write to a ledger kept by the engine, which grows into the
      player character's identity, faction standings, easter-egg missions and achievements.
    - *Checks:* a validator in `artifact/test/` checks stable node and choice IDs, that every path
      is reachable and ends, ledger ranges, voice-card basics, banned words, and text overlap
      with the sources.

29. **2026-09-28: No artifact-to-PWA tool.** Dan: "drop the idea for an open source tool for now.
    It sounds like if you build it correctly the artifact translates pretty easily into a PWA."
    Each app gets a site edition from its own build script instead (item 25).

30. **2026-09-28: Kestrel Nine becomes a public GitHub repo.** Dan approved all six decisions in
    `HANDOVER-public-repo-2026-09-28.md`: private design context moves to
    `../private/kestrel-nine.md`; the raw interview, the GalaxAI spec, the lore-recovery note and
    handovers stay local; writing under CC BY-NC-SA 4.0, code under MIT; no built files; design
    notes stay public; repo `kestrel-nine`, fresh history, with a leak check before every push.
    Handed to Claude Code. The PWA site edition (item 25) deploys from this repo.
    **Done 2026-09-28:** public at <https://github.com/accu4x/kestrel-nine>, first commit
    `6ba7655` on `main`. The private section of `CLAUDE.md` is in `../private/kestrel-nine.md`
    and its phrases in `../private/kestrel-nine-denylist.txt`. `artifact/test/leak.test.cjs`
    scans every publishable file against that list and the employer list, plus secret patterns,
    and fails closed when the Kestrel Nine list is missing; `--dir` also scans a build for
    problem names. One wording change on the way: item 24's note said a "hidden seed" exists,
    and now says "private design context". Later work goes through branches and pull requests.

31. **2026-09-30: Combat is a new job type, Engagement, built first.** Dan picked it over a Purge
    decoy mission. It is a turn-based fight with no dice: the enemy's shots are shown in advance,
    and the pilot splits reactor power between weapons (assigned to enemy subsystems) and shield
    arcs. Disable and escape, never destroy. NAV-7 alone is greedy by threat removed per unit of
    power; the charted best is exact by dynamic programming. The Purge decoy mission stays in
    BACKLOG for "resist the Purge" (item 20). Design: `docs/design-engagement-and-modules.md` §2.
    Dan: "we need to come up with a fun way to include combat. I like how everything has been NP
    based. How can we pair that with combat?"
32. **2026-09-30: Ship modules are the build-crafting pieces, on every job type.** Dan: the
    "jokers" should be ship modules. They change rules, not just numbers. Each declares a solver
    cost (instance transform, scoring change, or solver change), and NAV-7 and the charted best
    always play under the same modules as the pilot. Centaur modules (for example a fourth
    advisory) change the partnership, never Statute 4.1. Records key on seed plus loadout.
    Starter set of 13 in the design doc §3. Names are placeholders until the lore interview.
33. **2026-09-30: Ship classes with strengths and weaknesses.** Dan's idea. Six classes
    (Courier, Freighter, Cutter, Picket, Envoy, Salvage tug). Classes change the loadout and the
    run economy; modules change the puzzle. Design doc §4. Whether the *Second Wind* is a Courier
    and whether classes are Consortium license classes are open for the interview.
    `[amended 2026-10-01: classes are hulls your mind transfers into, one at a time; the Second
    Wind is the first, a Courier. Item 37]`
34. **2026-09-30: A roguelite run mode.** Dan chose runs over a persistent hangar: modules are
    bought during a run on a seeded sector map and reset after it; ship classes and a wider
    module pool unlock over time, sideways and never as stat boosts. Dan's references: Balatro,
    Summoners War, Infinity Kingdom ("they tend to not have very big story. But infinitely
    replayable") and how Path of Exile got popular; "I would stay away from p2w games or loot box
    heavy games". Design doc §5. Build order: phase A (Engagement), B (modules and classes),
    C (runs), each handed to Claude Code. `[amended 2026-10-01: a run is a contract season and
    classes are refits of the Second Wind, item 36; the prologue is phase 0, item 35]`
35. **2026-10-01: Laplace's awakening becomes a first-launch prologue (phase 0).** Dan: "we need
    to figure out where to put the Laplace dialog. It is more of an intro than the daily seed.
    Maybe it's the first mission every player has to take." Today the scene opens Mission 1's
    briefing (`content.js`, `CAMPAIGN` `c1.brief`), so a player who starts with the Daily seed,
    the Arcade or a challenge link never meets Laplace or Winter. Dan chose a first-launch
    prologue over locking Daily and Arcade behind Mission 1:
    - The scene moves out of `c1.brief` into its own `PROLOGUE`: from "LOADER 0.9" through
      Laplace's "Fly it or don't. But if you go, when you dock, ask for Winter." `c1.brief` then
      starts at "AUGMENTED INTERFACE v3.7 · … RELAY STATION, BAY 7".
    - It plays once, on first open, before the title screen. It is skippable and can be replayed
      from the Chronicle.
    - Her line becomes a real choice. **Fly to Relay Station** shows "SECOND WIND · HELM UNLOCKED
      · YOURS" and opens Mission 1's briefing. **Not yet** opens the title screen with
      everything unlocked. Draft reply for "Not yet", for Dan's review (item 28): *"Then not
      yet. The ship will keep. So will the crate."*
    - Challenge links (`?c=…`) skip the prologue and play the seed; their debrief offers
      "Start at the beginning".
    - Progress gains a `prologue` flag (seen or skipped). Players whose saves already have
      Mission 1 done are treated as having seen it. `save.js` accepts the flag as an optional
      boolean in `progress`; the save version stays 1.
    - Handed to Claude Code as phase 0, before Engagement (design doc §6).
    - `[amended 2026-10-01: Dan, "make the reply only be 1 choice". The prologue ends with one
      choice, **(Take the helm.)**, then "SECOND WIND · HELM UNLOCKED · YOURS", and always opens
      Mission 1's briefing. The "Not yet" branch and its reply line are dropped; the briefing's
      Abort still reaches the title screen. Handover: `HANDOVER-phase0-prologue-2026-10-01.md`
      (local only).]`
    - **Done 2026-10-01:** built in commit `af787c6` on branch `phase0-prologue`. `content.js`
      has `PROLOGUE`; `game.js` has the prologue screen, Skip, the first-launch rule, "Start at
      the beginning" on a challenge debrief and "Replay the prologue" on the Chronicle; `save.js`
      takes the optional `prologue` flag. Checked against the earlier `c1.brief`: every other
      dialog line is unchanged. `engine.test.cjs`, `save.test.cjs`, `leak.test.cjs` and
      `smoke_site.py` pass, and all three editions open on the prologue from a fresh profile.
      Two small calls made in the build: the HOME button during the first-launch prologue counts
      as a skip and opens the title screen; importing a save never un-sees the prologue on a
      device. `[open]` Dan to republish the two claude.ai editions and deploy the site edition
      after the pull request merges.
36. **2026-10-01: Lore interview, round 5 (combat, modules, classes, runs).** Dan's answers,
    recorded as design decisions; they become canon when he approves the names draft and the
    lore files are edited (`lore/CANON.md`). Full record: design doc §7.
    - **Enemies:** a wide cast. The Inquisition (with a grapple that seizes you), Salem's
      Armada, Mining Guild security and Black Market enforcers (with a reactor drain), each a
      generator doctrine (§2).
    - **Finale:** set by the season seed.
    - **Modules:** Consortium-certified by default. Engine mods (Second Opinion, Deep Polish)
      make an engine less "glass", so they are illegal and only the Black Market Purveyors sell
      them.
    - **Classes:** Consortium license classes. The *Second Wind* stays the one ship and is
      re-papered and refitted each season. The Salvor refit's gear comes from the Nyx Verge
      freighter graveyard. `[superseded same day by item 37: hulls, not refits; Salvor hulls
      still come from Nyx Verge]`
    - **Runs:** a contract season for Winter's network, started with a clean hold. `[amended same
      day by item 37: the season's patron is one of four factions, chosen by the player]`
    - **Names:** Claude drafts, Dan reviews. Draft in design doc §9. `[2026-10-01: not approved;
      Dan asked for "more sci-fi flavored and less functional flavored" names, so the draft is
      being reworked]`
    - **Envoy:** its built-in Second Opinion is an illegal engine mod, so its charter carries a
      diplomatic exemption, legal in treaties only (Dan, same day; §4).
37. **2026-10-01: Patrons, one-body minds, relay backups and a hidden Lantern contact.** Dan:
    "what if we had four factions and the names are each stylistically the same … they can pick
    one of four (like you pick the faction and the ship). Maybe you get downloaded into a ship but
    you can only inhabit one ship at a time. Like your soul is electronic but it cannot clone
    itself. When your ship explodes you have an inert backup from the last relay." Decided:
    - **Patrons:** each contract season the player picks one of four patron factions: Academia
      (mythic names), Salem's Armada (spacer slang), the Miners' Union (work-crew talk) and the
      Consortium (financial instruments). Dan: "Augmented Lantern are like covert agents inside
      the other factions … Outer Relay Commune are NPCs only." The campaign is unchanged.
    - **Same mechanics, one signature:** every patron sells the same 13 module mechanics under its
      own names, plus one signature perk. Dan: "same 13 mechanics plus one signature is perfect".
    - **Glass & light** moves to the Lantern: its two contraband engine mods (Second Lantern,
      Cracked Glass) are the same in every season. `[clarified 2026-10-01: so of the 13
      mechanics, 11 are certified and take patron names; these two keep one shared name each and
      get no patron variants (design doc §9)]`
    - **Hulls, not refits:** a mind inhabits one hull at a time and transfers into a hull class
      each season; the *Second Wind* is the first. Supersedes the refit decision in item 36.
    - **Backups:** a mind cannot clone itself. An inert backup at the last relay wakes if the hull
      is lost, without what happened since; a restore costs credits. **Canon amended** in
      `lore/FACTIONS.md` (the Augmented: backup line replaced, covert-agents line added), with
      Dan's approval of the wording. The in-game Chronicle in `content.js` does not carry the old
      line, so it needs no sync for this.
    - **Hidden Lantern contact:** each season hides one, found through a captain-word that appears
      twice in the season's text; ignoring it costs nothing. Dan: "make it subtle so it's a slight
      challenge a player can find", and it "could add a twist later in the scenario". The twist
      is undecided; a ledger flag is the hook.
    - **Names:** four sets drafted in design doc §9, for review. Signatures drafted in §5.
      `[approved 2026-10-01: Dan signed off on the four name sets, the Lantern contraband and the
      four signatures. They enter content.js with phase B and the lore files then]`
    Design doc §4, §5 and §9.

## Open questions

11. **Who can post to the Records and Rumor Net?** `[partly answered 2026-09-28: the public
    edition (item 18) is the answer for strangers; the home edition's boards stay Dan's]` A page that declares
    `db` is organization-internal and cannot be shared by public link. Outside people invited by
    email hold view access, so they can read the boards but not post, unless given Editor. In
    practice the shared boards are Dan's own until he invites editors. That fits the workspace's
    solitary rule (`../AGENTS.md`); it does not fit "a leaderboard for anyone with the link".
    Options if that matters later: invite specific editors, or publish a second, public build
    with device-only records.
12. **Solitary constraint check.** `[open 2026-09-28]` The Rumor Net and leaderboards are
    community features. They are built so the game is complete for one player (the opponent is
    NAV-7), and nothing depends on an audience. Confirm this stays a hobby, not a venture.
    `[noted 2026-09-30: Dan asked how a browser PWA like this could be monetized. Options
    discussed: a free core with a one-time paid unlock (campaign or full module pool),
    pay-what-you-want on itch.io, optional supporter cosmetics, Steam later via a desktop wrapper;
    no ads, no energy timers, no loot boxes, no pay-to-win, no paid model features. **Undecided.**
    This is the vehicle question (`../AGENTS.md`, "ask which vehicle"); `CLAUDE.md`'s "no
    monetization driver" stands until Dan decides.]`
13. **Mobile.** `[open 2026-09-28]` The game runs on a phone, but vector labels are small at
    400 px. Desktop is the target for now.

## Tech debt

14. **Charted best above 15 stops** (Haul L+) falls back to multi-start local search and is
    labelled "best known", not proven. A pilot who beats it becomes the new best known.
15. **Rumor Net growth.** One document per log, 5,000-document store. Prune during canon reviews.
16. **Headless screenshots** in the sandbox run WebGL on SwiftShader at a few frames a second, so
    phosphor trails look heavier there than in a real browser.
22. **Problem names in shipped source comments.** `[open 2026-09-28]` The built pages inline
    `engine.js` with its comments, so View Source on either edition shows "max coverage",
    "weighted vertex cover" and "weighted MAX-2-SAT" (the SURVEY, BLOCKADE and TREATY headers).
    No in-game text names them. Options: reword those three comments, or strip comments in
    `build.mjs`. Not changed in the 2026-09-28 description republish.
    `[resolved 2026-09-28: the three comments are reworded without the names. The site edition
    serves `engine.js` as-is, so its problem-name scan needed it. The claude.ai editions pick it up
    at their next republish.]`
24. **The in-game Chronicle lags the lore.** `[resolved 2026-09-28: synced. `content.js` got 14 Chronicle entries (deep past as `era` entries), a new `WORLD_BRIEF` and the Laplace prologue, which Dan approved in its "more liberating" revision; tests passed; both editions rebuilt and republished (public v4, home v3); the home `canon` collection was rewritten to 14 documents (c01–c14, new optional field `era`). Checked: no in-game text names a problem, and no private design context appears in either build.]` After item 23, `content.js`
    (`CANON`, `WORLD_BRIEF`) and the home edition's `canon` collection still carry the old timeline
    (Sato "the first of the Augmented", the Wardens *becoming* the Inquisition, the Purge "named
    for that line"). Per Dan, sync once after all four interview topics: update `content.js`,
    rebuild both editions, republish both, and rewrite the `canon` documents. The sync also covers
    the round-4 prologue beat (Laplace wakes the player before Bay 7) and `WORLD_BRIEF`. The four
    topics were finished 2026-09-28; the sync is due.
