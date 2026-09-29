# Kestrel Nine

*The machine is fast. The mind is wide. Neither is enough.*

A retro vector space game. You are an Augmented pilot, a human mind living in a machine, in a
future that has outlawed thinking machines. Every job is flown three ways:

1. **Solo:** you plan it alone.
2. **Centaur:** you plan it with NAV-7, your ship's legally limited navigation engine. It can
   polish your plan and give three advisories, but by law it cannot originate a plan.
3. **Debrief:** NAV-7's own one-pass run is revealed beside yours, with the charted best.

Four kinds of job, each a genuinely hard planning problem underneath:

- **Haul:** deliver to every port and come home.
- **Survey:** place drill rigs within a credit budget to cover the richest ore.
- **Blockade:** jam every lane with the least power so Inquisition cutters lose the trail.
- **Treaty:** choose treaty terms that win the most weighted support at a divided table.

Modes: a six-mission campaign (*Cold Start*), a Daily Seed shared by every pilot, and an Arcade
with shareable seed codes. The Records keep a **Centaur Index**: how often pilot plus engine
beat the engine alone. Pilots leave Ship's Logs on the **Rumor Net**; the best become canon in
the **Chronicle**.

## Play

- **In the browser:** the public edition on claude.ai,
  <https://claude.ai/artifact/VRsr1KHKCh5mcX1EBTYT8V>. Records stay on your device.
- **As an installable app** that plays offline: <https://play.latentmirror.com/kestrel-nine/>.
  Records stay on the device; export a save file from the Records screen to move them.

## Build and test

Node 20 or later. No dependencies.

```
node artifact/test/engine.test.cjs     # every solver valid; prints NAV-7 vs charted-best gaps
node artifact/test/leak.test.cjs       # run before every push; fails closed
node artifact/build.mjs                # home edition:   artifact/dist/kestrel-nine.html
node artifact/build.mjs --public       # public edition: artifact/dist/kestrel-nine-public.html
node artifact/test/save.test.cjs       # save-file validation
node artifact/build.mjs --site         # installable app:  artifact/dist/site/
python artifact/test/smoke_site.py     # headless check of the app (needs Python Playwright)
```

Built files are not committed; every build is reproducible from `artifact/src/`.
`CLAUDE.md` covers how the project is run, `OPEN-ITEMS.md` the decisions behind it, and `lore/`
the world. The design notes name the puzzle behind each job; the game itself never does.

## Licence

Two licences, because the writing and the machinery are different things.

- **The writing:** everything in `lore/`, and the story, dialog and Chronicle text in
  `artifact/src/content.js`, is [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
  Full text in `LICENSE`.
- **The code** in `artifact/` is MIT. Full text in `artifact/LICENSE`.
